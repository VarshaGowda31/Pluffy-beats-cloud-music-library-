import { dataManager } from "./data.js?v=force10";

// Check if already logged in
if (dataManager.getCurrentUser()) {
  location.href = "dashboard.html";
}

window.login = async () => {
  try {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    if (!email || !password) return alert("Please fill in all fields");

    const btn = document.querySelector('button[onclick="login()"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Logging in...';
    btn.disabled = true;

    await dataManager.login(email, password);
    location.href = "dashboard.html";
  } catch (error) {
    console.error("Login failed", error);
    alert(error.message);
    const btn = document.querySelector('button[onclick="login()"]');
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
};

window.signup = async () => {
  try {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    if (!email || !password) return alert("Please fill in all fields");

    const btn = document.querySelector('.btn-secondary');
    const originalText = btn.innerHTML;
    btn.innerText = 'Creating Account...';
    btn.disabled = true;

    await dataManager.register(email, password);
    location.href = "dashboard.html";
  } catch (error) {
    console.error("Signup failed", error);
    alert(error.message);
    const btn = document.querySelector('.btn-secondary');
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
};
