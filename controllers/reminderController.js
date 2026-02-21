import { Worker } from "bullmq";
import { Resend } from "resend";
import { supabaseClient } from "../tools/supabaseClient.js";
import {
  redisConnection,
  reminderQueue,
  REMINDER_QUEUE_NAME,
} from "../tools/redis.js";

const resend = new Resend(process.env.RESEND_KEY);

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const JOB_NAME = "send-vaccine-reminder";
const APPOINTMENT_HOUR_UTC = 9;

let reminderWorker = null;
const DEFAULT_REMINDER_OFFSET_DAYS = 14;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function parseReminderOffset(value) {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_REMINDER_OFFSET_DAYS;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function buildAppointmentDate(appointmentDate) {
  if (!isValidIsoDate(appointmentDate)) {
    return null;
  }
  const date = new Date(
    `${appointmentDate}T${String(APPOINTMENT_HOUR_UTC).padStart(2, "0")}:00:00.000Z`,
  );
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function isValidIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function buildReminderSchedule(appointmentDate, reminderOffsetDays) {
  const appointmentAt = buildAppointmentDate(appointmentDate);
  if (!appointmentAt) {
    return null;
  }

  const reminderAtMs = appointmentAt.getTime() - reminderOffsetDays * DAY_IN_MS;
  const nowMs = Date.now();
  return {
    appointmentAt,
    reminderAt: new Date(reminderAtMs),
    delayMs: Math.max(reminderAtMs - nowMs, 0),
    willSendImmediately: reminderAtMs <= nowMs,
  };
}

async function getReminderMetadata(userId, vacId, clinicId, vaccineName) {
  const [{ data: user, error: userError }, vaccineLookup] = await Promise.all([
    supabaseClient
      .from("user")
      .select("id, email, first_name, last_name")
      .eq("id", userId)
      .maybeSingle(),
    vacId
      ? supabaseClient.from("vaccine").select("id, name").eq("id", vacId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (userError) {
    throw new Error("Error fetching user: " + userError.message);
  }
  if (!user || !user.email) {
    throw new HttpError(404, "User not found or missing email");
  }

  const { data: vaccine, error: vaccineError } = vaccineLookup;
  if (vaccineError) {
    throw new Error("Error fetching vaccine: " + vaccineError.message);
  }
  if (vacId && !vaccine) {
    throw new HttpError(404, "Vaccine not found");
  }

  const resolvedVaccineName = vaccine?.name || vaccineName?.trim() || null;
  if (!resolvedVaccineName) {
    throw new HttpError(400, "Provide vac_id or vaccine_name");
  }

  let clinic = null;
  if (clinicId) {
    const { data, error } = await supabaseClient
      .from("clinic")
      .select("id, name")
      .eq("id", clinicId)
      .maybeSingle();

    if (error) {
      throw new Error("Error fetching clinic: " + error.message);
    }
    clinic = data;
  }

  return { user, clinic, vaccineName: resolvedVaccineName };
}

async function sendReminderEmail(jobData) {
  const fromEmail = process.env.REMINDER_FROM_EMAIL;
  if (!fromEmail) {
    throw new Error("REMINDER_FROM_EMAIL is not configured");
  }

  const userDisplayName =
    jobData.firstName?.trim() ||
    jobData.lastName?.trim() ||
    "there";

  const clinicText = jobData.clinicName
    ? `Clinic: ${jobData.clinicName}`
    : "Clinic: not specified";

  const html = `
    <p>Hi ${userDisplayName},</p>
    <p>This is your vaccine appointment reminder.</p>
    <p><strong>Vaccine:</strong> ${jobData.vaccineName}</p>
    <p><strong>Appointment date:</strong> ${jobData.appointmentDate}</p>
    <p><strong>${clinicText}</strong></p>
  `;

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: [jobData.email],
    subject: "Vaccine Appointment Reminder",
    html,
  });

  if (error) {
    throw new Error("Error sending reminder email: " + error.message);
  }
}

function ensureReminderWorker() {
  if (reminderWorker) {
    return reminderWorker;
  }

  reminderWorker = new Worker(
    REMINDER_QUEUE_NAME,
    async (job) => {
      if (job.name !== JOB_NAME) {
        return;
      }
      await sendReminderEmail(job.data);
    },
    {
      connection: redisConnection,
      concurrency: 5,
    },
  );

  reminderWorker.on("failed", (job, error) => {
    console.error(
      `Reminder job failed (id: ${job?.id ?? "unknown"}):`,
      error.message,
    );
  });

  reminderWorker.on("error", (error) => {
    console.error("Reminder worker error:", error.message);
  });

  return reminderWorker;
}

async function scheduleReminder(req, res) {
  try {
    const authUserId = req.user?.sub;
    if (!authUserId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const {
      user_id,
      vac_id,
      vaccine_name,
      clinic_id,
      appointment_date,
      reminder_offset_days,
    } = req.body ?? {};

    if (user_id && String(user_id) !== String(authUserId)) {
      return res.status(403).json({
        message: "Cannot schedule reminders for another user",
      });
    }

    if (!appointment_date) {
      return res.status(400).json({
        message: "appointment_date is required",
      });
    }

    const reminderOffsetDays = parseReminderOffset(reminder_offset_days);
    if (reminderOffsetDays === null) {
      return res.status(400).json({
        message: "reminder_offset_days must be a non-negative integer",
      });
    }

    const schedule = buildReminderSchedule(appointment_date, reminderOffsetDays);
    if (!schedule) {
      return res.status(400).json({
        message: "appointment_date must be a valid date (YYYY-MM-DD)",
      });
    }

    const { user, vaccineName, clinic } = await getReminderMetadata(
      authUserId,
      vac_id,
      clinic_id,
      vaccine_name,
    );

    const vaccineIdentity = vac_id || vaccine_name?.trim();
    const jobId = `reminder:${authUserId}:${vaccineIdentity}:${appointment_date}:${reminderOffsetDays}`;

    const existingJob = await reminderQueue.getJob(jobId);
    if (existingJob) {
      return res.status(200).json({
        message: "Reminder already scheduled",
        data: {
          job_id: jobId,
          appointment_date,
          reminder_offset_days: reminderOffsetDays,
          scheduled_for: schedule.reminderAt.toISOString(),
          will_send_immediately: schedule.willSendImmediately,
        },
      });
    }

    await reminderQueue.add(
      JOB_NAME,
      {
        userId: authUserId,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        vacId: vac_id || null,
        vaccineName: vaccineName || "Vaccine",
        clinicName: clinic?.name || null,
        appointmentDate: appointment_date,
      },
      {
        delay: schedule.delayMs,
        jobId,
      },
    );

    return res.status(201).json({
      message: "Reminder scheduled successfully",
      data: {
        job_id: jobId,
        appointment_date,
        reminder_offset_days: reminderOffsetDays,
        scheduled_for: schedule.reminderAt.toISOString(),
        will_send_immediately: schedule.willSendImmediately,
      },
    });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ message: error.message });
    }
    if (String(error?.message || "").toLowerCase().includes("jobid")) {
      return res.status(409).json({ message: "Reminder already scheduled" });
    }
    return res.status(500).json({
      message: "Error scheduling reminder: " + error.message,
    });
  }
}

async function listReminders(req, res) {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const jobs = await reminderQueue.getJobs(
      ["delayed", "waiting", "active", "completed", "failed"],
      0,
      100,
      true,
    );

    const ownJobs = jobs.filter(
      (job) => job?.name === JOB_NAME && String(job?.data?.userId) === String(userId),
    );

    const data = await Promise.all(
      ownJobs.map(async (job) => ({
        job_id: job.id,
        status: await job.getState(),
        appointment_date: job.data?.appointmentDate || null,
        vaccine_name: job.data?.vaccineName || null,
        created_at: new Date(job.timestamp).toISOString(),
        scheduled_for: new Date(job.timestamp + (job.delay || 0)).toISOString(),
      })),
    );

    return res.status(200).json({
      message: "Reminders fetched successfully",
      data,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching reminders: " + error.message,
    });
  }
}

async function cancelReminder(req, res) {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const jobId = req.params.jobId;
    if (!jobId) {
      return res.status(400).json({ message: "jobId is required" });
    }

    const job = await reminderQueue.getJob(jobId);
    if (!job) {
      return res.status(404).json({ message: "Reminder not found" });
    }

    if (String(job?.data?.userId) !== String(userId)) {
      return res
        .status(403)
        .json({ message: "Cannot cancel another user's reminder" });
    }

    await job.remove();
    return res.status(200).json({ message: "Reminder canceled successfully" });
  } catch (error) {
    return res.status(500).json({
      message: "Error canceling reminder: " + error.message,
    });
  }
}

export {
  resend,
  ensureReminderWorker,
  scheduleReminder,
  listReminders,
  cancelReminder,
};
