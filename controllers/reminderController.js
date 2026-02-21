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

function parseReminderOffset(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function buildAppointmentDate(appointmentDate) {
  const date = new Date(`${appointmentDate}T${String(APPOINTMENT_HOUR_UTC).padStart(2, "0")}:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
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

async function getReminderMetadata(userId, vacId, clinicId) {
  const [{ data: user, error: userError }, { data: vaccine, error: vaccineError }] =
    await Promise.all([
      supabaseClient
        .from("user")
        .select("id, email, first_name, last_name")
        .eq("id", userId)
        .maybeSingle(),
      supabaseClient.from("vaccine").select("id, name").eq("id", vacId).maybeSingle(),
    ]);

  if (userError) {
    throw new Error("Error fetching user: " + userError.message);
  }
  if (!user || !user.email) {
    throw new Error("User not found or missing email");
  }

  if (vaccineError) {
    throw new Error("Error fetching vaccine: " + vaccineError.message);
  }
  if (!vaccine) {
    throw new Error("Vaccine not found");
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

  return { user, vaccine, clinic };
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
    const {
      user_id,
      vac_id,
      clinic_id,
      appointment_date,
      reminder_offset_days,
    } = req.body ?? {};

    if (!user_id || !vac_id || !appointment_date) {
      return res.status(400).json({
        message: "user_id, vac_id, and appointment_date are required",
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

    const { user, vaccine, clinic } = await getReminderMetadata(
      user_id,
      vac_id,
      clinic_id,
    );

    const jobId = `reminder:${user_id}:${vac_id}:${appointment_date}:${reminderOffsetDays}`;

    await reminderQueue.add(
      JOB_NAME,
      {
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        vaccineName: vaccine.name || "Vaccine",
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
    return res.status(500).json({
      message: "Error scheduling reminder: " + error.message,
    });
  }
}

export { resend, ensureReminderWorker, scheduleReminder };
