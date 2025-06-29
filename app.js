// const API_BASE_URL = 'http://localhost:5000/api';
const API_BASE_URL = 'https://technical-team-06-back.onrender.com/api';


let userId = localStorage.getItem('al_khair_user_id');
if (!userId) {
  userId = crypto.randomUUID();
  localStorage.setItem('al_khair_user_id', userId);
}

const form = document.getElementById('donationForm');
const typeFields = document.getElementById('typeFields');
const formMessage = document.getElementById('formMessage');
const showFormBtn = document.getElementById('showFormBtn');
const showListBtn = document.getElementById('showListBtn');
const donationsList = document.getElementById('donationsList');
const donationsGrid = document.getElementById('donationsGrid');
const donationCount = document.getElementById('donationCount');

let currentType = 'monetary';

function renderTypeFields(type) {
  let html = '';
  if (type === 'monetary') {
    html = `
      <input type="number" id="monetaryAmount" placeholder="Amount (EGP) *" min="0" step="0.01" required>
      <select id="monetaryPurpose">
        <option value="general">General Use (Where Most Needed)</option>
        <option value="medical-supplies">Medical Supplies & Equipment</option>
        <option value="patient-care">Patient Care & Treatment</option>
        <option value="clinic-maintenance">Clinic Maintenance & Operations</option>
        <option value="staff-training">Staff Training & Development</option>
      </select>
    `;
  } else if (type === 'medical') {
    html = `
      <input type="text" id="medicalItemName" placeholder="Item Name *" required>
      <input type="number" id="medicalQuantity" placeholder="Quantity *" min="1" required>
      <textarea id="medicalDescription" placeholder="Description (e.g., expiry date, condition)"></textarea>
    `;
  } else if (type === 'volunteer') {
    html = `
      <input type="text" id="volunteerSkill" placeholder="Your Skill/Role *" required>
      <input type="number" id="volunteerHours" placeholder="Available Hours per Week/Month *" min="0.5" step="0.5" required>
      <textarea id="volunteerTimes" placeholder="Preferred Days/Times"></textarea>
    `;
  }
  typeFields.innerHTML = html;
}
renderTypeFields(currentType);

// Handle donation type change
form.addEventListener('change', (e) => {
  if (e.target.name === 'donationType') {
    currentType = e.target.value;
    renderTypeFields(currentType);
  }
});

// Toggle form/list
showFormBtn.onclick = () => {
  form.style.display = '';
  donationsList.style.display = 'none';
  showFormBtn.classList.add('active');
  showListBtn.classList.remove('active');
  formMessage.textContent = '';
};
showListBtn.onclick = () => {
  form.style.display = 'none';
  donationsList.style.display = '';
  showFormBtn.classList.remove('active');
  showListBtn.classList.add('active');
  fetchDonations();
};

// Form submission
form.onsubmit = async (e) => {
  e.preventDefault();
  formMessage.textContent = '';
  formMessage.className = '';

  // Collect data
  const donorName = document.getElementById('donorName').value.trim();
  const donorEmail = document.getElementById('donorEmail').value.trim();
  const donorPhone = document.getElementById('donorPhone').value.trim();
  const donorAddress = document.getElementById('donorAddress').value.trim();
  const notes = document.getElementById('notes').value.trim();

  if (!donorName || !donorEmail || !donorPhone) {
    showMessage('Please fill in Donor Name, Email, and Phone.', 'error');
    return;
  }

  let donationData = {
    donorName, donorEmail, donorPhone,
    donorAddress: donorAddress || null,
    donationType: currentType,
    notes: notes || null,
    userId
  };

  // Type-specific
  if (currentType === 'monetary') {
    const amount = document.getElementById('monetaryAmount').value;
    const purpose = document.getElementById('monetaryPurpose').value;
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      showMessage('Please enter a valid monetary amount.', 'error');
      return;
    }
    donationData.monetaryAmount = parseFloat(amount);
    donationData.monetaryPurpose = purpose;
  } else if (currentType === 'medical') {
    const item = document.getElementById('medicalItemName').value.trim();
    const qty = document.getElementById('medicalQuantity').value;
    const desc = document.getElementById('medicalDescription').value.trim();
    if (!item || !qty || isNaN(qty) || parseInt(qty) <= 0) {
      showMessage('Please enter valid Medical Item Name and Quantity.', 'error');
      return;
    }
    donationData.medicalItemName = item;
    donationData.medicalQuantity = parseInt(qty);
    donationData.medicalDescription = desc || null;
  } else if (currentType === 'volunteer') {
    const skill = document.getElementById('volunteerSkill').value.trim();
    const hours = document.getElementById('volunteerHours').value;
    const times = document.getElementById('volunteerTimes').value.trim();
    if (!skill || !hours || isNaN(hours) || parseFloat(hours) <= 0) {
      showMessage('Please enter valid Volunteer Skill/Role and Available Hours.', 'error');
      return;
    }
    donationData.volunteerSkill = skill;
    donationData.volunteerHours = parseFloat(hours);
    donationData.volunteerTimes = times || null;
  }

  // Submit
  try {
    const res = await fetch(`${API_BASE_URL}/donations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(donationData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || `Server error: ${res.status}`);
    }
    showMessage('Donation submitted successfully! Thank you for your generosity.', 'success');
    form.reset();
    renderTypeFields('monetary');
    currentType = 'monetary';
  } catch (err) {
    showMessage('Error submitting donation: ' + err.message, 'error');
  }
};

function showMessage(msg, type) {
  formMessage.textContent = msg;
  formMessage.className = type ? type : '';
  formMessage.style.display = 'block';
  window.scrollTo({ top: form.offsetTop - 40, behavior: 'smooth' });
  if (type === 'success') {
    setTimeout(() => {
      formMessage.textContent = '';
      formMessage.className = '';
      formMessage.style.display = 'none';
    }, 4000);
  }
}

// Fetch and render donations
async function fetchDonations() {
  donationsGrid.innerHTML = 'Loading...';
  try {
    const res = await fetch(`${API_BASE_URL}/donations`);
    if (!res.ok) throw new Error('Failed to fetch');
    const data = await res.json();
    donationCount.textContent = data.length;
    if (data.length === 0) {
      donationsGrid.innerHTML = `<p>No donations submitted yet. Be the first to donate!</p>`;
      return;
    }
    donationsGrid.innerHTML = data.map(donation => `
      <div class="donation-card">
        <div style="font-size:0.9em;color:#6b7280;">${donation.timestamp ? new Date(donation.timestamp).toLocaleString() : 'N/A'}</div>
        <div class="donation-type ${donation.donationType}">${donation.donationType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
        <div style="font-weight:bold;font-size:1.1em;">${donation.donorName}</div>
        <div><b>Email:</b> ${donation.donorEmail}</div>
        <div><b>Phone:</b> ${donation.donorPhone}</div>
        ${donation.donationType === 'monetary' ? `
          <div><b>Amount:</b> ${donation.monetaryAmount} EGP</div>
          <div><b>Purpose:</b> ${donation.monetaryPurpose}</div>
        ` : ''}
        ${donation.donationType === 'medical' ? `
          <div><b>Item:</b> ${donation.medicalItemName}</div>
          <div><b>Quantity:</b> ${donation.medicalQuantity}</div>
          ${donation.medicalDescription ? `<div><b>Description:</b> ${donation.medicalDescription}</div>` : ''}
        ` : ''}
        ${donation.donationType === 'volunteer' ? `
          <div><b>Skill:</b> ${donation.volunteerSkill}</div>
          <div><b>Hours:</b> ${donation.volunteerHours}</div>
          ${donation.volunteerTimes ? `<div><b>Availability:</b> ${donation.volunteerTimes}</div>` : ''}
        ` : ''}
        ${donation.notes ? `<div style="margin-top:6px;font-style:italic;">"${donation.notes}"</div>` : ''}
      </div>
    `).join('');
  } catch (err) {
    donationsGrid.innerHTML = `<p style="color:#b91c1c;">Error loading donations. Please check the backend connection and CORS settings.</p>`;
  }
}

// On page load, show form
form.style.display = '';
donationsList.style.display = 'none'; 
