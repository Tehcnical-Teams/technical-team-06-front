import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

function App() {
  // Global variables provided by the Canvas environment (moved here for direct access)
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
  const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
  const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [donations, setDonations] = useState([]);
  const [formMessage, setFormMessage] = useState('');
  const [showDonationForm, setShowDonationForm] = useState(true); // State to toggle form/list view

  // Form states
  const [donorName, setDonorName] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  const [donorPhone, setDonorPhone] = useState('');
  const [donorAddress, setDonorAddress] = useState('');
  const [donationType, setDonationType] = useState('monetary');
  const [monetaryAmount, setMonetaryAmount] = useState('');
  const [monetaryPurpose, setMonetaryPurpose] = useState('general');
  const [medicalItemName, setMedicalItemName] = useState('');
  const [medicalQuantity, setMedicalQuantity] = useState('');
  const [medicalDescription, setMedicalDescription] = useState('');
  const [volunteerSkill, setVolunteerSkill] = useState('');
  const [volunteerHours, setVolunteerHours] = useState('');
  const [volunteerTimes, setVolunteerTimes] = useState('');
  const [notes, setNotes] = useState('');

  // Initialize Firebase Auth and get user ID
  useEffect(() => {
    let unsubscribeAuth;
    try {
      const appInstance = initializeApp(firebaseConfig);
      const firestoreInstance = getFirestore(appInstance);
      const firebaseAuthInstance = getAuth(appInstance);

      setDb(firestoreInstance);
      setAuth(firebaseAuthInstance);

      unsubscribeAuth = onAuthStateChanged(firebaseAuthInstance, async (user) => {
        if (user) {
          setUserId(user.uid);
          setLoading(false);
          console.log("User authenticated:", user.uid);
        } else {
          try {
            if (initialAuthToken) {
              console.log("Attempting signInWithCustomToken...");
              await signInWithCustomToken(firebaseAuthInstance, initialAuthToken);
            } else {
              console.log("initialAuthToken not available. Attempting signInAnonymously...");
              await signInAnonymously(firebaseAuthInstance);
            }
          } catch (error) {
            console.error("Firebase Auth Error (Custom Token or initial Anonymously failed):", error);
            if (initialAuthToken && (error.code === 'auth/invalid-custom-token' || error.code === 'auth/invalid-claims')) {
              console.log("Custom token failed. Attempting signInAnonymously as fallback...");
              try {
                await signInAnonymously(firebaseAuthInstance);
              } catch (anonymousError) {
                console.error("Firebase Auth Error (Anonymous fallback failed):", anonymousError);
                setFormMessage('Authentication failed. Please try again. Check console for details.');
                setUserId(crypto.randomUUID());
                setLoading(false);
              }
            } else {
              setFormMessage('Authentication failed. Please try again. Check console for details.');
              setUserId(crypto.randomUUID());
              setLoading(false);
            }
          }
        }
      });
    } catch (error) {
      console.error("Firebase Initialization Error:", error);
      setFormMessage('Failed to initialize application. Check console for details.');
      setLoading(false);
    }

    return () => {
      if (unsubscribeAuth) {
        unsubscribeAuth();
      }
    };
  }, []); // Run once on mount

  // Subscribe to donations when DB and userId are available
  useEffect(() => {
    let unsubscribeDonations;
    if (db && userId) {
      const donationsColRef = collection(db, `artifacts/${appId}/public/data/donations`);
      const q = donationsColRef; // Removed orderBy as per instructions

      unsubscribeDonations = onSnapshot(q, (snapshot) => {
        const fetchedDonations = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        fetchedDonations.sort((a, b) => {
          const timeA = a.timestamp && typeof a.timestamp.toDate === 'function' ? a.timestamp.toDate().getTime() : 0;
          const timeB = b.timestamp && typeof b.timestamp.toDate === 'function' ? b.timestamp.toDate().getTime() : 0;
          return timeB - timeA;
        });
        setDonations(fetchedDonations);
      }, (error) => {
        console.error("Error fetching donations:", error);
        setFormMessage('Error loading donations. Please check your permissions.');
      });
    }

    return () => {
      if (unsubscribeDonations) {
        unsubscribeDonations();
      }
    };
  }, [db, userId]); // Re-run when db or userId changes

  const addDonation = async (donationData) => {
    if (!db) {
      throw new Error('Firestore DB not initialized.');
    }
    return await addDoc(collection(db, `artifacts/${appId}/public/data/donations`), {
      ...donationData,
      timestamp: serverTimestamp(),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormMessage('');

    if (!userId) {
      setFormMessage('User not authenticated. Cannot submit donation. Please refresh.');
      return;
    }
    if (!donorName || !donorEmail || !donorPhone) {
      setFormMessage('Please fill in Donor Name, Email, and Phone.');
      return;
    }

    const donationData = {
      donorName,
      donorEmail,
      donorPhone,
      donorAddress: donorAddress || 'N/A',
      donationType,
      notes: notes || 'No notes provided',
      userId: userId,
    };

    switch (donationType) {
      case 'monetary':
        if (!monetaryAmount || isNaN(monetaryAmount) || parseFloat(monetaryAmount) <= 0) {
          setFormMessage('Please enter a valid monetary amount.');
          return;
        }
        donationData.monetaryAmount = parseFloat(monetaryAmount);
        donationData.monetaryPurpose = monetaryPurpose;
        break;
      case 'medical-supplies':
        if (!medicalItemName || !medicalQuantity || isNaN(medicalQuantity) || parseInt(medicalQuantity) <= 0) {
          setFormMessage('Please enter valid Medical Item Name and Quantity.');
          return;
        }
        donationData.medicalItemName = medicalItemName;
        donationData.medicalQuantity = parseInt(medicalQuantity);
        donationData.medicalDescription = medicalDescription || 'N/A';
        break;
      case 'volunteering-time':
        if (!volunteerSkill || !volunteerHours || isNaN(volunteerHours) || parseFloat(volunteerHours) <= 0) {
          setFormMessage('Please enter valid Volunteer Skill/Role and Available Hours.');
          return;
        }
        donationData.volunteerSkill = volunteerSkill;
        donationData.volunteerHours = parseFloat(volunteerHours);
        donationData.volunteerTimes = volunteerTimes || 'N/A';
        break;
      default:
        setFormMessage('Please select a donation type.');
        return;
    }

    try {
      await addDonation(donationData);
      setFormMessage('Donation submitted successfully! Thank you for your generosity.');
      setDonorName('');
      setDonorEmail('');
      setDonorPhone('');
      setDonorAddress('');
      setMonetaryAmount('');
      setMonetaryPurpose('general');
      setMedicalItemName('');
      setMedicalQuantity('');
      setMedicalDescription('');
      setVolunteerSkill('');
      setVolunteerHours('');
      setVolunteerTimes('');
      setNotes('');
      setDonationType('monetary');
    } catch (error) {
      console.error("Error submitting donation: ", error);
      setFormMessage('Error submitting donation. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">Loading application...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-rose-100 p-4 font-sans text-gray-800 flex items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-4xl border border-red-100">
        <h1 className="text-4xl font-extrabold text-center text-red-900 mb-6 drop-shadow-md">
          Al Khair Clinic Charity Event
        </h1>
        <p className="text-center text-lg text-gray-700 mb-8">
          Support our mission to provide free health services.
        </p>

        {/* Removed userId display from here */}

        <div className="flex justify-center mb-6 space-x-4">
          <button
            onClick={() => setShowDonationForm(true)}
            className={`px-6 py-2 rounded-xl text-lg font-semibold transition duration-300 transform hover:scale-105 ${
              showDonationForm
                ? 'bg-red-700 text-white shadow-lg'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Donate Now
          </button>
          <button
            onClick={() => setShowDonationForm(false)}
            className={`px-6 py-2 rounded-xl text-lg font-semibold transition duration-300 transform hover:scale-105 ${
              !showDonationForm
                ? 'bg-red-700 text-white shadow-lg'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            View Donations
          </button>
        </div>

        {formMessage && (
          <div className={`p-4 mb-4 rounded-xl text-center font-medium ${
            formMessage.includes('successfully') ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-red-100 text-red-700 border border-red-300'
          }`}>
            {formMessage}
          </div>
        )}

        {showDonationForm ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <h2 className="text-2xl font-bold text-red-800 mb-4 border-b border-rose-200 pb-2">Donor Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="donorName" className="block text-sm font-medium text-gray-700 mb-1">
                  Your Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="donorName"
                  value={donorName}
                  onChange={(e) => setDonorName(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-red-500 focus:border-red-500 transition duration-150"
                  required
                />
              </div>
              <div>
                <label htmlFor="donorEmail" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="donorEmail"
                  value={donorEmail}
                  onChange={(e) => setDonorEmail(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-red-500 focus:border-red-500 transition duration-150"
                  required
                />
              </div>
              <div>
                <label htmlFor="donorPhone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  id="donorPhone"
                  value={donorPhone}
                  onChange={(e) => setDonorPhone(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-red-500 focus:border-red-500 transition duration-150"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="donorAddress" className="block text-sm font-medium text-gray-700 mb-1">
                  Address (Optional)
                </label>
                <textarea
                  id="donorAddress"
                  value={donorAddress}
                  onChange={(e) => setDonorAddress(e.target.value)}
                  rows="2"
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-red-500 focus:border-red-500 transition duration-150"
                ></textarea>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-red-800 mb-4 pt-6 border-t border-rose-200 pb-2">Donation Type</h2>
            <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-4">
              <label className="flex items-center space-x-2 p-3 bg-red-50 rounded-xl border border-red-200 cursor-pointer flex-1 hover:bg-red-100 transition duration-150">
                <input
                  type="radio"
                  name="donationType"
                  value="monetary"
                  checked={donationType === 'monetary'}
                  onChange={(e) => setDonationType(e.target.value)}
                  className="form-radio text-red-600 h-5 w-5"
                />
                <span className="text-lg font-medium text-gray-800">Monetary Donation</span>
              </label>
              <label className="flex items-center space-x-2 p-3 bg-rose-50 rounded-xl border border-rose-200 cursor-pointer flex-1 hover:bg-rose-100 transition duration-150">
                <input
                  type="radio"
                  name="donationType"
                  value="medical-supplies"
                  checked={donationType === 'medical-supplies'}
                  onChange={(e) => setDonationType(e.target.value)}
                  className="form-radio text-rose-600 h-5 w-5"
                />
                <span className="text-lg font-medium text-gray-800">Medical Supplies</span>
              </label>
              <label className="flex items-center space-x-2 p-3 bg-pink-50 rounded-xl border border-pink-200 cursor-pointer flex-1 hover:bg-pink-100 transition duration-150">
                <input
                  type="radio"
                  name="donationType"
                  value="volunteering-time"
                  checked={donationType === 'volunteering-time'}
                  onChange={(e) => setDonationType(e.target.value)}
                  className="form-radio text-pink-600 h-5 w-5"
                />
                <span className="text-lg font-medium text-gray-800">Volunteering Time</span>
              </label>
            </div>

            {donationType === 'monetary' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 bg-red-50 rounded-xl border border-red-200">
                <div>
                  <label htmlFor="monetaryAmount" className="block text-sm font-medium text-gray-700 mb-1">
                    Amount (EGP) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="monetaryAmount"
                    value={monetaryAmount}
                    onChange={(e) => setMonetaryAmount(e.target.value)}
                    min="0"
                    step="0.01"
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-red-500 focus:border-red-500 transition duration-150"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="monetaryPurpose" className="block text-sm font-medium text-gray-700 mb-1">
                    Purpose of Donation
                  </label>
                  <select
                    id="monetaryPurpose"
                    value={monetaryPurpose}
                    onChange={(e) => setMonetaryPurpose(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-red-500 focus:border-red-500 transition duration-150"
                  >
                    <option value="general">General Use (Where Most Needed)</option>
                    <option value="medical-supplies">Medical Supplies & Equipment</option>
                    <option value="patient-care">Patient Care & Treatment</option>
                    <option value="clinic-maintenance">Clinic Maintenance & Operations</option>
                    <option value="staff-training">Staff Training & Development</option>
                  </select>
                </div>
              </div>
            )}

            {donationType === 'medical-supplies' && (
              <div className="space-y-4 mt-4 p-4 bg-rose-50 rounded-xl border border-rose-200">
                <div>
                  <label htmlFor="medicalItemName" className="block text-sm font-medium text-gray-700 mb-1">
                    Item Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="medicalItemName"
                    value={medicalItemName}
                    onChange={(e) => setMedicalItemName(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-rose-500 focus:border-rose-500 transition duration-150"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="medicalQuantity" className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="medicalQuantity"
                    value={medicalQuantity}
                    onChange={(e) => setMedicalQuantity(e.target.value)}
                    min="1"
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-rose-500 focus:border-rose-500 transition duration-150"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="medicalDescription" className="block text-sm font-medium text-gray-700 mb-1">
                    Description (e.g., expiry date, condition)
                  </label>
                  <textarea
                    id="medicalDescription"
                    value={medicalDescription}
                    onChange={(e) => setMedicalDescription(e.target.value)}
                    rows="3"
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-rose-500 focus:border-rose-500 transition duration-150"
                  ></textarea>
                </div>
              </div>
            )}

            {donationType === 'volunteering-time' && (
              <div className="space-y-4 mt-4 p-4 bg-pink-50 rounded-xl border border-pink-200">
                <div>
                  <label htmlFor="volunteerSkill" className="block text-sm font-medium text-gray-700 mb-1">
                    Your Skill/Role <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="volunteerSkill"
                    value={volunteerSkill}
                    onChange={(e) => setVolunteerSkill(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-pink-500 focus:border-pink-500 transition duration-150"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="volunteerHours" className="block text-sm font-medium text-gray-700 mb-1">
                    Available Hours per Week/Month <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="volunteerHours"
                    value={volunteerHours}
                    onChange={(e) => setVolunteerHours(e.target.value)}
                    min="0.5"
                    step="0.5"
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-pink-500 focus:border-pink-500 transition duration-150"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="volunteerTimes" className="block text-sm font-medium text-gray-700 mb-1">
                    Preferred Days/Times
                  </label>
                  <textarea
                    id="volunteerTimes"
                    value={volunteerTimes}
                    onChange={(e) => setVolunteerTimes(e.target.value)}
                    rows="3"
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-pink-500 focus:border-pink-500 transition duration-150"
                  ></textarea>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Additional Notes/Message
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows="3"
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-red-500 focus:border-red-500 transition duration-150"
              ></textarea>
            </div>

            <button
              type="submit"
              className="w-full py-3 px-6 bg-red-700 text-white font-bold rounded-xl text-xl shadow-lg hover:bg-red-800 transition duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-red-400"
            >
              Submit Donation
            </button>
          </form>
        ) : (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-red-800 mb-4 border-b border-rose-200 pb-2">All Donations ({donations.length})</h2>
            {donations.length === 0 ? (
              <p className="text-center text-gray-600 p-8 bg-gray-50 rounded-xl border border-gray-200">
                No donations submitted yet. Be the first to donate!
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {donations.map((donation) => (
                  <div key={donation.id} className="bg-white p-6 rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition duration-200 ease-in-out">
                    <p className="text-sm text-gray-500 mb-2">
                      {/* Safely display timestamp */}
                      {donation.timestamp && typeof donation.timestamp.toDate === 'function'
                        ? new Date(donation.timestamp.toDate()).toLocaleString()
                        : 'N/A'}
                    </p>
                    <h3 className="text-xl font-bold text-red-800 mb-2">{donation.donorName}</h3>
                    <p className="text-gray-700 mb-1"><span className="font-semibold">Email:</span> {donation.donorEmail}</p>
                    <p className="text-gray-700 mb-3"><span className="font-semibold">Phone:</span> {donation.donorPhone}</p>
                    <p className="text-md font-semibold text-gray-800 mb-2">
                      Donation Type: <span className={`px-2 py-1 rounded-full text-white text-sm ${
                        donation.donationType === 'monetary' ? 'bg-red-600' :
                        donation.donationType === 'medical-supplies' ? 'bg-rose-600' :
                        'bg-pink-600'
                      }`}>
                        {donation.donationType === 'monetary' ? 'Monetary' :
                         donation.donationType === 'medical-supplies' ? 'Medical Supplies' :
                         'Volunteering Time'}
                      </span>
                    </p>
                    {donation.donationType === 'monetary' && (
                      <>
                        <p className="text-lg font-bold text-red-700">
                          Amount: {donation.monetaryAmount} EGP
                        </p>
                        <p><span className="font-semibold">Purpose:</span> {
                          donation.monetaryPurpose === 'general' ? 'General Use' :
                          donation.monetaryPurpose === 'medical-supplies' ? 'Medical Supplies & Equipment' :
                          donation.monetaryPurpose === 'patient-care' ? 'Patient Care & Treatment' :
                          donation.monetaryPurpose === 'clinic-maintenance' ? 'Clinic Maintenance & Operations' :
                          donation.monetaryPurpose === 'staff-training' ? 'Staff Training & Development' :
                          'N/A'
                        }</p>
                      </>
                    )}
                    {donation.donationType === 'medical-supplies' && (
                      <>
                        <p><span className="font-semibold">Item:</span> {donation.medicalItemName}</p>
                        <p><span className="font-semibold">Quantity:</span> {donation.medicalQuantity}</p>
                        {donation.medicalDescription && <p><span className="font-semibold">Description:</span> {donation.medicalDescription}</p>}
                      </>
                    )}
                    {donation.donationType === 'volunteering-time' && (
                      <>
                        <p><span className="font-semibold">Skill:</span> {donation.volunteerSkill}</p>
                        <p><span className="font-semibold">Hours:</span> {donation.volunteerHours}</p>
                        {donation.volunteerTimes && <p><span className="font-semibold">Availability:</span> {donation.volunteerTimes}</p>}
                      </>
                    )}
                    {donation.notes && (
                      <p className="mt-2 text-gray-600 italic">"{donation.notes}"</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
