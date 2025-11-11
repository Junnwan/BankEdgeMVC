function startSync() {
  const status = document.getElementById("sync-status");
  status.textContent = "Synchronizing data...";
  status.style.color = "blue";

  setTimeout(() => {
    status.textContent = "Data synchronization completed successfully!";
    status.style.color = "green";
  }, 3000);
}

// New logic for EdgeDevices.html manual sync
document.addEventListener('DOMContentLoaded', () => {

    // Check if FontAwesome is available (used for icons)
    const isFontAwesomeLoaded = document.querySelector('link[href*="font-awesome"]');

    // Manual Sync for Edge Devices Page
    const syncButtons = document.querySelectorAll('.button-sync');

    syncButtons.forEach(button => {
        button.addEventListener('click', function() {
            const deviceId = this.getAttribute('data-device-id');
            const icon = this.querySelector('.fa-rotate-right');

            // 1. Start Sync Simulation
            this.disabled = true;
            if (icon) {
                icon.classList.add('fa-spin');
            }

            // Update button text for the full 'Sync' button (button-outline variant)
            if (this.classList.contains('button-outline')) {
                 this.innerHTML = `<i class="fa-solid fa-rotate-right fa-spin mr-2"></i> Syncing...`;
            }

            // 2. Simulate API call delay (2 seconds)
            setTimeout(() => {
                // 3. Complete Sync Simulation

                // Show temporary success notification
                alert(`${deviceId} synchronized successfully! Reloading data...`);

                // In a real application, we would call the server here, then reload the page/data.
                // For this simulation, we will simply reload the page to show new random data/status change.
                window.location.reload();
            }, 2000);
        });
    });
});

// New logic for Tab Switching on ML Insights page
document.addEventListener('DOMContentLoaded', () => {
    // ... (Existing sync button logic) ...

    // ML Insights Tab Logic
    const tabTriggers = document.querySelectorAll('.tabs-list .tab-trigger');
    const tabContents = document.querySelectorAll('.tab-content');

    tabTriggers.forEach(trigger => {
        trigger.addEventListener('click', function() {
            const targetId = this.getAttribute('data-tab');

            // Deactivate all triggers and hide all contents
            tabTriggers.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.add('hidden'));

            // Activate current trigger
            this.classList.add('active');

            // Show target content
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.remove('hidden');
            }
        });
    });
});

// New logic for System Management Tabs and Modals
document.addEventListener('DOMContentLoaded', () => {
    // ... (Existing sync button logic) ...

    // ML Insights/Settings Tab Logic (Reused)
    const tabTriggers = document.querySelectorAll('.tabs-list .tab-trigger');
    const tabContents = document.querySelectorAll('.tab-content');

    tabTriggers.forEach(trigger => {
        trigger.addEventListener('click', function() {
            const targetId = this.getAttribute('data-tab');

            // Deactivate all triggers and hide all contents
            tabTriggers.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.add('hidden'));

            // Activate current trigger
            this.classList.add('active');

            // Show target content
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.remove('hidden');
            }
        });
    });

    // --- Admin Modal Logic ---
    const modal = document.getElementById('add-admin-modal');
    const openBtn = document.getElementById('add-admin-btn');
    const closeBtn = document.getElementById('close-admin-modal');
    const createBtn = document.getElementById('create-admin-btn');
    const errorAlert = document.getElementById('admin-validation-error');
    const errorMessage = document.getElementById('error-message');
    const usernameInput = document.getElementById('admin-username');
    const passwordInput = document.getElementById('admin-password');

    if (modal) {
        // Open modal
        openBtn.addEventListener('click', () => {
            modal.classList.remove('hidden');
            errorAlert.classList.add('hidden'); // Clear errors on open
        });

        // Close modal
        closeBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    }

    // Validation and Creation Simulation
    if (createBtn) {
        createBtn.addEventListener('click', function() {
            const username = usernameInput.value;
            const password = passwordInput.value;
            let error = '';

            // Validation functions (copied from app.py logic)
            const validateEmail = (email) => email.endsWith('@bankedge.com');
            const validatePassword = (pwd) => {
                const hasCapital = /[A-Z]/.test(pwd);
                const hasSmall = /[a-z]/.test(pwd);
                const hasSymbol = /[^A-Za-z0-9]/.test(pwd);
                return hasCapital && hasSmall && hasSymbol;
            };

            if (!validateEmail(username)) {
                error = 'Username must be an email ending with @bankedge.com';
            } else if (!validatePassword(password)) {
                error = 'Password must contain at least one capital letter, one small letter, and one symbol';
            }

            if (error) {
                errorMessage.textContent = error;
                errorAlert.classList.remove('hidden');
            } else {
                // Successful Validation Simulation
                errorAlert.classList.add('hidden');

                // Simulate Toast Notification (using alert for simplicity)
                alert(`SUCCESS: Admin account ${username} created successfully! (Reloading page to refresh list)`);

                // Simulate model upload success for the other button
                if (this.id === 'upload-model-btn') {
                    alert('SUCCESS: ML model uploaded successfully. Deployment in progress...');
                }

                // In a real Flask app, this would be an AJAX POST call.
                // Since this is a simulation, we simply reload to show a clean modal.
                window.location.reload();
            }
        });
    }

    // Upload Model Button Simulation
    const uploadBtn = document.getElementById('upload-model-btn');
    if (uploadBtn) {
        uploadBtn.addEventListener('click', function() {
             alert('SUCCESS: ML model uploaded successfully. Deployment in progress...');
        });
    }
});