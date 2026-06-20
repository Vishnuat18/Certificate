/* ==========================================================================
   Certificate Generator Business Logic
   Implements live bindings, dynamic QR code rendering, scaling, and PDF/PNG exports.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  let qrcode = null;

  // --- HTML Elements Cache ---
  const scaleWrapper = document.getElementById('certScaleWrapper');
  const certificate = document.getElementById('certificate');
  const previewPanel = document.querySelector('.preview-panel');
  
  const inputName = document.getElementById('inputName');
  const viewName = document.getElementById('viewName');
  
  const selectCourse = document.getElementById('selectCourse');
  const inputCourse = document.getElementById('inputCourse');
  const viewCourse = document.getElementById('viewCourse');
  
  const inputStartDate = document.getElementById('inputStartDate');
  const viewStartDate = document.getElementById('viewStartDate');
  
  const inputEndDate = document.getElementById('inputEndDate');
  const viewEndDate = document.getElementById('viewEndDate');
  
  const inputDuration = document.getElementById('inputDuration');
  const viewDuration = document.getElementById('viewDuration');
  
  const selectDomain = document.getElementById('selectDomain');
  const inputDomain = document.getElementById('inputDomain');
  const viewDomain = document.getElementById('viewDomain');
  
  const inputIssueDate = document.getElementById('inputIssueDate');
  const viewIssueDate = document.getElementById('viewIssueDate');
  
  const inputCertId = document.getElementById('inputCertId');
  const viewCertId = document.getElementById('viewCertId');
  
  const inputVerifyUrl = document.getElementById('inputVerifyUrl');
  const viewVerifyUrl = document.getElementById('viewVerifyUrl');
  
  const inputDescription = document.getElementById('inputDescription');
  const viewDescription = document.getElementById('viewDescription');

  const inputLogo = document.getElementById('inputLogo');
  const certLogo = document.getElementById('certLogo');
  const btnRegenQr = document.getElementById('btnRegenQr');

  const btnGenId = document.getElementById('btnGenId');
  const btnDownloadPdf = document.getElementById('btnDownloadPdf');
  const btnDownloadPng = document.getElementById('btnDownloadPng');
  const btnPrint = document.getElementById('btnPrint');

  /* ==========================================================================
     DATE FORMATTING UTILITY
     ========================================================================== */
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parts[2];
    
    const standardMonths = [
      'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 
      'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
    ];
    
    const monthName = standardMonths[monthIndex] || '';
    const formattedDay = day.padStart(2, '0');
    return `${formattedDay} ${monthName} ${year}`;
  };

  /* ==========================================================================
     PREVIEW LIVE SYNCING: Event Listeners
     ========================================================================== */
  
  // Direct text bindings
  const syncInput = (inputEl, viewEl, callback = null) => {
    inputEl.addEventListener('input', (e) => {
      viewEl.textContent = e.target.value;
      if (callback) callback(e.target.value);
    });
  };

  // Helper to sync date input values with formatted output
  const syncDateInput = (inputEl, viewEl, callback = null) => {
    const updateView = () => {
      viewEl.textContent = formatDate(inputEl.value);
      if (callback) callback(inputEl.value);
    };
    inputEl.addEventListener('input', updateView);
    inputEl.addEventListener('change', updateView);
    updateView(); // Initialize view text on load
  };

  syncInput(inputName, viewName, () => updateQRCode());
  syncInput(inputCourse, viewCourse, () => updateQRCode());
  syncDateInput(inputStartDate, viewStartDate);
  syncDateInput(inputEndDate, viewEndDate);
  syncInput(inputDuration, viewDuration);
  syncInput(inputDomain, viewDomain);
  syncDateInput(inputIssueDate, viewIssueDate);
  syncInput(inputCertId, viewCertId, () => updateQRCode());

  // Handle selects dropdown logic
  const handleCourseChange = () => {
    if (selectCourse.value === 'other') {
      inputCourse.style.display = 'block';
      viewCourse.textContent = inputCourse.value;
    } else {
      inputCourse.style.display = 'none';
      inputCourse.value = selectCourse.value;
      viewCourse.textContent = selectCourse.value;
    }
    updateQRCode();
  };
  selectCourse.addEventListener('change', handleCourseChange);
  handleCourseChange(); // Trigger on load

  const handleDomainChange = () => {
    if (selectDomain.value === 'other') {
      inputDomain.style.display = 'block';
      viewDomain.textContent = inputDomain.value;
    } else {
      inputDomain.style.display = 'none';
      inputDomain.value = selectDomain.value;
      viewDomain.textContent = selectDomain.value;
    }
  };
  selectDomain.addEventListener('change', handleDomainChange);
  handleDomainChange(); // Trigger on load

  // Sync description (converting newlines to HTML line breaks)
  const syncDescription = () => {
    viewDescription.innerHTML = inputDescription.value.replace(/\n/g, '<br>');
  };
  inputDescription.addEventListener('input', syncDescription);
  syncDescription(); // Initial sync on load

  // Sync verification URL and trigger QR code regeneration
  inputVerifyUrl.addEventListener('input', (e) => {
    const urlVal = e.target.value.trim();
    const finalUrl = urlVal.startsWith('http') ? urlVal : (urlVal ? `https://${urlVal}` : '');
    viewVerifyUrl.textContent = finalUrl || 'https://aroxtech.com/verify';
    updateQRCode();
  });

  // --- Company Logo Upload Handler ---
  inputLogo.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        certLogo.src = event.target.result;
        const certWatermarkLogo = document.getElementById('certWatermarkLogo');
        if (certWatermarkLogo) {
          certWatermarkLogo.src = event.target.result;
        }
      };
      reader.readAsDataURL(file);
    }
  });

  // Handle manual QR code regeneration button
  btnRegenQr.addEventListener('click', () => {
    updateQRCode();
  });

  /* ==========================================================================
     QR CODE GENERATION
     ========================================================================== */
  function updateQRCode() {
    const qrContainer = document.getElementById('qrContainer');
    if (!qrContainer) return;
    
    // Clear old QR code canvas
    qrContainer.innerHTML = '';
    
    const certIdVal = inputCertId.value.trim();
    const nameVal = inputName.value.trim();
    const courseVal = inputCourse.value.trim();
    const urlVal = inputVerifyUrl.value.trim();
    
    let qrContent = '';
    if (urlVal) {
      const finalUrl = urlVal.startsWith('http') ? urlVal : `https://${urlVal}`;
      qrContent = JSON.stringify({
        certificateId: certIdVal,
        candidateName: nameVal,
        internshipTitle: courseVal,
        verificationURL: finalUrl
      });
    } else {
      qrContent = certIdVal;
    }

    try {
      // Create QRCode.js instance with high resolution and error correction
      qrcode = new QRCode(qrContainer, {
        text: qrContent,
        width: 256,
        height: 256,
        colorDark: '#000000', // Black
        colorLight: '#ffffff', // White
        correctLevel: QRCode.CorrectLevel.H // High error correction
      });

      // Add center logo overlay
      const centerLogo = document.createElement('img');
      centerLogo.src = 'assets/qr logo.png';
      centerLogo.className = 'qr-center-logo';
      centerLogo.onerror = () => {
        centerLogo.style.display = 'none';
      };
      qrContainer.appendChild(centerLogo);
    } catch (err) {
      console.error('Failed to create QR code: ', err);
    }
  }

  // Initial QR code setup
  updateQRCode();

  /* ==========================================================================
     AUTO-GENERATE UNIQUE CERTIFICATE ID
     ========================================================================== */
  btnGenId.addEventListener('click', () => {
    const year = 2026;
    // Pad sequence to 4 digits (random between 1 and 9999)
    const randNum = Math.floor(Math.random() * 10000);
    const sequence = String(randNum).padStart(4, '0');
    const randomizedId = `AT/INT/${year}/${sequence}`;
    
    inputCertId.value = randomizedId;
    viewCertId.textContent = randomizedId;
    updateQRCode();
  });

  /* ==========================================================================
     RESPONSIVE SCALE PREVIEW PIPELINE
     ========================================================================== */
  function adjustPreviewScale() {
    if (!previewPanel || !scaleWrapper) return;
    
    const margin = 60; // Clean spacing around scaled content
    const availableWidth = previewPanel.clientWidth - margin;
    const availableHeight = previewPanel.clientHeight - margin;
    
    // Certificate container original dimensions: 800px x 1131px
    const widthScale = availableWidth / 800;
    const heightScale = availableHeight / 1131;
    
    // Limit maximum scale factor to 1.0 to keep it sharp
    const scaleFactor = Math.min(widthScale, heightScale, 1.0);
    
    scaleWrapper.style.transform = `scale(${scaleFactor})`;

    // Fit preview scroller size to scaled boundary
    const scroller = scaleWrapper.parentElement;
    if (scroller) {
      scroller.style.width = `${800 * scaleFactor}px`;
      scroller.style.height = `${1131 * scaleFactor}px`;
    }
  }

  // Adjust preview scaling on load and resize
  window.addEventListener('resize', adjustPreviewScale);
  adjustPreviewScale();
  // Double-check scale immediately after layout
  setTimeout(adjustPreviewScale, 100);

  /* ==========================================================================
     EXPORT LOGIC: PDF & PNG (HIGH FIDELITY)
     ========================================================================== */

  // Utility to handle temporary scaling resets during high-density capture
  function prepareCapture(callback) {
    const originalTransform = scaleWrapper.style.transform;
    const originalShadow = certificate.style.boxShadow;
    const scroller = scaleWrapper.parentElement;
    const originalScrollerWidth = scroller ? scroller.style.width : '';
    const originalScrollerHeight = scroller ? scroller.style.height : '';
    
    // 1. Reset scale to 1 to render canvas elements at 100% resolution (800x1131)
    scaleWrapper.style.transform = 'none';
    if (scroller) {
      scroller.style.width = '800px';
      scroller.style.height = '1131px';
    }
    // 2. Hide shadow boundary lines during capture
    certificate.style.boxShadow = 'none';
    
    // Give DOM browser layout engine 150ms to register style adjustments
    setTimeout(() => {
      callback(() => {
        // Restore styling after output completion
        scaleWrapper.style.transform = originalTransform;
        certificate.style.boxShadow = originalShadow;
        if (scroller) {
          scroller.style.width = originalScrollerWidth;
          scroller.style.height = originalScrollerHeight;
        }
      });
    }, 150);
  }

  // --- PNG Download (HQ) ---
  btnDownloadPng.addEventListener('click', () => {
    prepareCapture((restoreCallback) => {
      html2canvas(certificate, {
        scale: 3, // 3x density render for ultra-clear vectors & text
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      }).then(canvas => {
        const link = document.createElement('a');
        const formattedName = inputName.value.trim().toLowerCase().replace(/\s+/g, '_');
        link.download = `${formattedName}_internship_certificate.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();
        
        restoreCallback();
      }).catch(err => {
        console.error('PNG export failed:', err);
        restoreCallback();
        alert('PNG export failed. Please check browser console.');
      });
    });
  });

  // --- PDF Download (HQ A4 Portrait) ---
  btnDownloadPdf.addEventListener('click', () => {
    prepareCapture((restoreCallback) => {
      html2canvas(certificate, {
        scale: 3, // HQ scaling
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      }).then(canvas => {
        const imgData = canvas.toDataURL('image/png', 1.0);
        
        // Setup jsPDF context
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });
        
        // A4 pages are exactly 210mm x 297mm
        pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
        
        const formattedName = inputName.value.trim().toLowerCase().replace(/\s+/g, '_');
        pdf.save(`${formattedName}_internship_certificate.pdf`);
        
        restoreCallback();
      }).catch(err => {
        console.error('PDF export failed:', err);
        restoreCallback();
        alert('PDF export failed. Please check browser console.');
      });
    });
  });

  // --- Print Command ---
  btnPrint.addEventListener('click', () => {
    window.print();
  });
});
