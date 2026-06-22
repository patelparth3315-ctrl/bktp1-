const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

/**
 * Generates a professional PDF invoice using PDFKit.
 * Returns a Buffer containing the PDF data.
 */
async function generateInvoicePDF(booking) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        bufferPages: true
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // --- Colors & Styling ---
      const brandColor = '#1e293b';
      const secondaryColor = '#64748b';
      const accentColor = '#059669';

      // --- Header: Logo & Invoice Info ---
      // Try to load logo if exists
      const logoPath = path.join(__dirname, '../../../frontend/public/logo.png');
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 45, { width: 120 });
      } else {
        doc.fillColor(brandColor)
           .fontSize(20)
           .font('Helvetica-Bold')
           .text('YOUTHCAMPING.', 50, 50);
      }

      doc.fillColor(brandColor)
         .fontSize(20)
         .font('Helvetica-Bold')
         .text('INVOICE', 400, 50, { align: 'right' });

      doc.fillColor(secondaryColor)
         .fontSize(10)
         .font('Helvetica')
         .text(`Invoice No: ${booking.bookingId}`, 400, 75, { align: 'right' })
         .text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 400, 90, { align: 'right' })
         .text(`Status: ${booking.paymentStatus.toUpperCase()}`, 400, 105, { align: 'right' });

      // Horizontal line
      doc.moveTo(50, 130)
         .lineTo(550, 130)
         .strokeColor('#e2e8f0')
         .lineWidth(1)
         .stroke();

      // --- Info Section: Guest & Travel ---
      doc.fillColor(brandColor)
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('Guest Details', 50, 150)
         .text('Travel Details', 300, 150);

      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(secondaryColor)
         .text('Full Name:', 50, 170)
         .fillColor(brandColor)
         .font('Helvetica-Bold')
         .text(booking.fullName || booking.name || 'N/A', 120, 170)
         
         .font('Helvetica')
         .fillColor(secondaryColor)
         .text('Mobile:', 50, 185)
         .fillColor(brandColor)
         .text(`+91 ${booking.mobile || booking.phone || 'N/A'}`, 120, 185);

      if (booking.email) {
        doc.font('Helvetica')
           .fillColor(secondaryColor)
           .text('Email:', 50, 200)
           .fillColor(brandColor)
           .text(booking.email, 120, 200);
      }

      // Travel Details Y positions (computed dynamically to allow wrapping)
      let travelY = 170;
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(secondaryColor)
         .text('Trip:', 300, travelY);
      doc.fillColor(brandColor)
         .font('Helvetica-Bold')
         .text(booking.tripName || booking.tripId || 'N/A', 380, travelY, { width: 170 });
         
      // Get position after printing trip name
      travelY = doc.y + 5;

      doc.font('Helvetica')
         .fillColor(secondaryColor)
         .text('Transport:', 300, travelY);
      doc.fillColor(brandColor)
         .text(`${booking.trainClass || 'N/A'} (${booking.ticketStatus || 'N/A'})`, 380, travelY, { width: 170 });
      
      travelY = doc.y + 5;
         
      doc.font('Helvetica')
         .fillColor(secondaryColor)
         .text('Room:', 300, travelY);
      doc.fillColor(brandColor)
         .text(booking.roomType || 'N/A', 380, travelY, { width: 170 });
      
      travelY = doc.y + 15;

      // Calculate table top dynamically to prevent overlap
      const tableTop = Math.max(220, travelY);

      // --- Table Headers ---
      doc.rect(50, tableTop, 500, 25).fill('#f8fafc');
      doc.fillColor(secondaryColor)
         .font('Helvetica-Bold')
         .fontSize(9)
         .text('DESCRIPTION', 60, tableTop + 8)
         .text('QUANTITY', 350, tableTop + 8)
         .text('AMOUNT', 480, tableTop + 8, { align: 'right' });

      // Table Row (allow wrapping)
      const rowTop = tableTop + 35;
      doc.fillColor(brandColor)
         .font('Helvetica')
         .fontSize(10)
         .text(`Trip Package - ${booking.tripName || booking.tripId || 'TBD'} (${booking.trainClass || 'Standard'})`, 60, rowTop, { width: 280 });
      
      const rowBottom = doc.y;

      doc.font('Helvetica')
         .text(`${booking.numberOfTravelers || 1} Traveller(s)`, 350, rowTop);
      doc.font('Helvetica-Bold')
         .text(`INR ${(booking.totalAmount || 0).toLocaleString('en-IN')}`, 480, rowTop, { align: 'right' });

      const lineY = Math.max(rowBottom, rowTop + 15) + 10;
      doc.moveTo(50, lineY)
         .lineTo(550, lineY)
         .strokeColor('#f1f5f9')
         .stroke();

      // --- Totals Section ---
      const totalsTop = lineY + 15;
      
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(secondaryColor)
         .text('Subtotal:', 350, totalsTop, { width: 100 })
         .fillColor(brandColor)
         .text(`INR ${(booking.totalAmount || 0).toLocaleString('en-IN')}`, 450, totalsTop, { width: 90, align: 'right' });

      doc.fillColor(secondaryColor)
         .text('Advance Paid:', 350, totalsTop + 20, { width: 100 })
         .fillColor(accentColor)
         .text(`- INR ${(booking.advancePaid || 0).toLocaleString('en-IN')}`, 450, totalsTop + 20, { width: 90, align: 'right' });

      // Grand Total Box
      doc.rect(340, totalsTop + 40, 210, 35).fill(brandColor);
      doc.fillColor('#fff')
         .font('Helvetica-Bold')
         .fontSize(10)
         .text('BALANCE DUE', 350, totalsTop + 53, { width: 100 })
         .fontSize(12)
         .text(`INR ${(booking.remainingAmount || 0).toLocaleString('en-IN')}`, 450, totalsTop + 52, { width: 90, align: 'right' });

      // --- Footer ---
      const pageHeight = doc.page.height;
      doc.fillColor(secondaryColor)
         .fontSize(8)
         .font('Helvetica')
         .text('Thank you for choosing YouthCamping!', 50, pageHeight - 100, { align: 'center', width: 500 })
         .text('This is a computer-generated document and does not require a signature.', 50, pageHeight - 85, { align: 'center', width: 500 })
         .text('Support: support@youthcamping.com | Website: youthcamping.com', 50, pageHeight - 70, { align: 'center', width: 500 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateInvoicePDF
};
