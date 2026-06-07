const apiUrl = "https://script.google.com/macros/s/AKfycbzCntH_2gPVJH-1kUBIM0elClGd9arp2byllcFmaki4hn95BnAwKBk8P0W2mcsPFRTVsA/exec";
const authStorageKey = "lifeTrackerPassword";

const incomeCategories = [
  "Salary",
  "Freelance",
  "Course Income",
  "Interest",
  "Other"
];

const expenseCategories = [
  "Food",
  "Travel",
  "Medical",
  "Household",
  "Construction work",
  "Education",
  "Shopping",
  "Other"
];

const tabButtons = document.querySelectorAll(".tab-button");
const loginPage = document.getElementById("loginPage");
const appShell = document.getElementById("appShell");
const loginForm = document.getElementById("loginForm");
const loginPassword = document.getElementById("loginPassword");
const loginMessage = document.getElementById("loginMessage");
const logoutButton = document.getElementById("logoutButton");
const dashboardPage = document.getElementById("dashboardPage");
const personalPage = document.getElementById("personalPage");
const transactionList = document.getElementById("transactionList");
const transactionForm = document.getElementById("transactionForm");
const rowNumberInput = document.getElementById("rowNumber");
const typeInput = document.getElementById("type");
const categoryInput = document.getElementById("category");
const formTitle = document.getElementById("formTitle");
const formMessage = document.getElementById("formMessage");
const cancelEditButton = document.getElementById("cancelEditButton");
const totalIncome = document.getElementById("totalIncome");
const totalExpense = document.getElementById("totalExpense");
const currentBalance = document.getElementById("currentBalance");

let allTransactions = [];

function getPassword() {
  return localStorage.getItem(authStorageKey) || "";
}

function savePassword(password) {
  localStorage.setItem(authStorageKey, password);
}

function clearPassword() {
  localStorage.removeItem(authStorageKey);
}

function buildApiUrl(action, params) {
  const url = new URL(apiUrl);

  url.searchParams.set("action", action);
  url.searchParams.set("password", getPassword());

  Object.keys(params || {}).forEach(function(key) {
    url.searchParams.set(key, params[key]);
  });

  return url.toString();
}

function showLogin() {
  loginPage.classList.remove("hidden");
  appShell.classList.add("hidden");
}

function showApp() {
  loginPage.classList.add("hidden");
  appShell.classList.remove("hidden");
}

async function checkLogin(password) {
  const url = new URL(apiUrl);

  url.searchParams.set("action", "login");
  url.searchParams.set("password", password);

  const response = await fetch(url.toString());
  const result = await response.json();

  return result.success === true;
}

function getSavedTransactions() {
  const saved = localStorage.getItem("lifeTrackerTransactions");

  if (!saved) {
    return [];
  }

  return JSON.parse(saved);
}

function saveTransactions(transactions) {
  localStorage.setItem("lifeTrackerTransactions", JSON.stringify(transactions));
}

function formatMoney(amount) {
  return "\u20b9" + Number(amount).toLocaleString("en-IN");
}

function updateCategories(selectedCategory) {
  const categories = typeInput.value === "Income" ? incomeCategories : expenseCategories;

  categoryInput.innerHTML = "";

  categories.forEach(function(category) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryInput.appendChild(option);
  });

  if (selectedCategory) {
    categoryInput.value = selectedCategory;
  }
}

function showPage(pageName) {
  tabButtons.forEach(function(button) {
    button.classList.toggle("active", button.dataset.page === pageName);
  });

  dashboardPage.classList.toggle("active", pageName === "dashboard");
  personalPage.classList.toggle("active", pageName === "personal");
}

function renderDashboard(summary) {
  totalIncome.textContent = formatMoney(summary.totalIncome);
  totalExpense.textContent = formatMoney(summary.totalExpense);
  currentBalance.textContent = formatMoney(summary.balance);
}

function calculateSummary(transactions) {
  let income = 0;
  let expense = 0;

  transactions.forEach(function(transaction) {
    if (!transaction.date || !transaction.type || !transaction.category || Number(transaction.amount) <= 0) {
      return;
    }

    if (transaction.type === "Income") {
      income += Number(transaction.amount) || 0;
    }

    if (transaction.type === "Expense") {
      expense += Number(transaction.amount) || 0;
    }
  });

  return {
    totalIncome: income,
    totalExpense: expense,
    balance: income - expense
  };
}

function renderTransactions(transactions) {
  const validTransactions = transactions.filter(function(transaction) {
    return transaction.date && transaction.type && transaction.category && Number(transaction.amount) > 0;
  });

  transactionList.innerHTML = "";

  if (validTransactions.length === 0) {
    transactionList.innerHTML = "<p>No transactions found.</p>";
    return;
  }

  validTransactions.forEach(function(transaction) {
    const item = document.createElement("article");
    const amountClass = transaction.type === "Income" ? "income-amount" : "expense-amount";
    const amountPrefix = transaction.type === "Income" ? "+" : "-";

    item.className = "transaction-item";
    item.innerHTML = `
      <div class="transaction-main">
        <strong>${transaction.category}</strong>
        <span>${transaction.notes || transaction.type}</span>
        <div class="transaction-date">${transaction.date}</div>
      </div>
      <div class="transaction-amount ${amountClass}">
        ${amountPrefix}${formatMoney(transaction.amount)}
      </div>
      <div class="transaction-actions">
        <button class="action-button edit-button" data-row="${transaction.rowNumber}" type="button">Edit</button>
        <button class="action-button delete-button" data-row="${transaction.rowNumber}" type="button">Delete</button>
      </div>
    `;

    transactionList.appendChild(item);
  });
}

async function sendToBackend(data) {
  const action = data.action || "add";
  const requestData = Object.assign({}, data, {
    password: getPassword()
  });

  await fetch(buildApiUrl(action), {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(requestData)
  });
}

async function deleteFromBackend(rowNumber) {
  const deleteUrl = buildApiUrl("delete", {
    rowNumber: rowNumber
  });
  const response = await fetch(deleteUrl);
  const result = await response.json();

  if (!result.success) {
    throw new Error(result.message || "Delete failed.");
  }
}

function waitForSheetUpdate() {
  return new Promise(function(resolve) {
    setTimeout(resolve, 900);
  });
}

async function loadTransactions() {
  try {
    const response = await fetch(buildApiUrl("transactions"));
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || "Unauthorized request.");
    }

    allTransactions = result.data || [];
    saveTransactions(allTransactions);
  } catch (error) {
    if (String(error.message).includes("Unauthorized")) {
      clearPassword();
      showLogin();
      loginMessage.textContent = "Please login again.";
      return;
    }

    allTransactions = getSavedTransactions();
  }

  renderDashboard(calculateSummary(allTransactions));
  renderTransactions(allTransactions);
}

function resetForm() {
  transactionForm.reset();
  rowNumberInput.value = "";
  formTitle.textContent = "Add Transaction";
  cancelEditButton.classList.remove("show");
  updateCategories();
}

function startEdit(rowNumber) {
  const transaction = allTransactions.find(function(item) {
    return String(item.rowNumber) === String(rowNumber);
  });

  if (!transaction) {
    return;
  }

  rowNumberInput.value = transaction.rowNumber;
  transactionForm.date.value = transaction.date;
  transactionForm.type.value = transaction.type;
  updateCategories(transaction.category);
  transactionForm.amount.value = transaction.amount;
  transactionForm.notes.value = transaction.notes || "";

  formTitle.textContent = "Edit Transaction";
  cancelEditButton.classList.add("show");
  formMessage.textContent = "";
  showPage("personal");
}

async function deleteTransaction(rowNumber) {
  const shouldDelete = confirm("Delete this transaction?");

  if (!shouldDelete) {
    return;
  }

  allTransactions = allTransactions.filter(function(item) {
    return String(item.rowNumber) !== String(rowNumber);
  });

  saveTransactions(allTransactions);
  renderDashboard(calculateSummary(allTransactions));
  renderTransactions(allTransactions);

  try {
    await deleteFromBackend(rowNumber);
    await waitForSheetUpdate();
    formMessage.textContent = "Transaction deleted.";
    await loadTransactions();
  } catch (error) {
    formMessage.textContent = "Delete failed. Please redeploy Apps Script.";
    await loadTransactions();
  }
}

tabButtons.forEach(function(button) {
  button.addEventListener("click", function() {
    showPage(button.dataset.page);
    loadTransactions();
  });
});

loginForm.addEventListener("submit", async function(event) {
  event.preventDefault();

  const password = loginPassword.value.trim();

  loginMessage.textContent = "Checking...";

  try {
    const isValid = await checkLogin(password);

    if (!isValid) {
      loginMessage.textContent = "Wrong password.";
      return;
    }

    savePassword(password);
    loginForm.reset();
    loginMessage.textContent = "";
    showApp();
    await loadTransactions();
  } catch (error) {
    loginMessage.textContent = "Login failed. Check your Apps Script deployment.";
  }
});

logoutButton.addEventListener("click", function() {
  clearPassword();
  localStorage.removeItem("lifeTrackerTransactions");
  allTransactions = [];
  showLogin();
});

typeInput.addEventListener("change", function() {
  updateCategories();
});

cancelEditButton.addEventListener("click", function() {
  resetForm();
  formMessage.textContent = "";
});

transactionList.addEventListener("click", function(event) {
  const editButton = event.target.closest(".edit-button");
  const deleteButton = event.target.closest(".delete-button");

  if (editButton) {
    startEdit(editButton.dataset.row);
  }

  if (deleteButton) {
    deleteTransaction(deleteButton.dataset.row);
  }
});

transactionForm.addEventListener("submit", async function(event) {
  event.preventDefault();

  const rowNumber = rowNumberInput.value;
  const transaction = {
    action: rowNumber ? "update" : "add",
    rowNumber: rowNumber,
    date: transactionForm.date.value,
    type: transactionForm.type.value,
    category: transactionForm.category.value,
    amount: Number(transactionForm.amount.value),
    notes: transactionForm.notes.value.trim()
  };

  formMessage.textContent = rowNumber ? "Updating..." : "Saving...";

  await sendToBackend(transaction);

  resetForm();
  formMessage.textContent = rowNumber ? "Transaction updated." : "Transaction saved.";
  await waitForSheetUpdate();
  await loadTransactions();
  showPage("dashboard");
});

updateCategories();

if (getPassword()) {
  showApp();
  loadTransactions();
} else {
  showLogin();
}
