function login(req, res) {
  res.send("Login successful");
}

function signup(req, res) {
  res.send("Signup successful");
}

module.exports = {
  login,
  signup,
};
