import { getDb } from '../db.js';
import { ObjectId } from 'mongodb';
import express from 'express';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fetch from 'node-fetch';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const { id } = req.query;
        if (!id || !ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid customer ID' });
        }

        const db = await getDb();
        const customer = await db.collection('customers').findOne({ _id: new ObjectId(id) });
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const transactions = await db.collection('transactions')
            .find({ customerId: new ObjectId(id) })
            .sort({ date: 1, createdAt: 1 })
            .toArray();

        // Compute totals
        let totalDebt = 0;
        let totalPaid = 0;
        transactions.forEach(t => {
            const isDebt = ['debt', 'debit', 'DEBT'].includes(t.type) || (t.amount < 0 && t.type !== 'payment');
            const amount = Math.abs(t.amount || 0);
            if (isDebt) totalDebt += amount;
            else totalPaid += amount;
        });
        const balance = totalDebt - totalPaid;

        // Create PDF
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        let page = pdfDoc.addPage();
        const { width, height } = page.getSize();
        const margin = 40;
        let y = height - margin;

        // Title
        page.drawText('Customer Account Statement', { x: margin, y, size: 20, font: boldFont });
        y -= 30;

        // Customer Info
        page.drawText(`Name: ${customer.name}`, { x: margin, y, size: 12, font });
        y -= 15;
        page.drawText(`Phone: ${customer.phone || 'N/A'}`, { x: margin, y, size: 12, font });
        y -= 15;
        page.drawText(`Date: ${new Date().toISOString().split('T')[0]}`, { x: margin, y, size: 12, font });
        y -= 30;

        // Table Header
        const colX = [margin, margin + 80, margin + 150, margin + 230, margin + 400];
        // Date | Type | Amount | Note | Invoice Image
        
        page.drawText('Date', { x: colX[0], y, size: 10, font: boldFont });
        page.drawText('Type', { x: colX[1], y, size: 10, font: boldFont });
        page.drawText('Amount', { x: colX[2], y, size: 10, font: boldFont });
        page.drawText('Note', { x: colX[3], y, size: 10, font: boldFont });
        page.drawText('Invoice', { x: colX[4], y, size: 10, font: boldFont });
        
        y -= 5;
        page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
        y -= 15;

        // Transactions
        for (const t of transactions) {
            // Check if we need a new page
            if (y < margin + 120) {
                page = pdfDoc.addPage();
                y = height - margin;
            }

            const isDebt = ['debt', 'debit', 'DEBT'].includes(t.type) || (t.amount < 0 && t.type !== 'payment');
            const amount = Math.abs(t.amount || 0);
            const dateStr = new Date(t.date || t.createdAt).toISOString().split('T')[0];
            const typeStr = isDebt ? 'DEBT' : 'PAYMENT';
            const amountStr = amount.toFixed(2);
            const noteStr = t.note || '';

            // Draw text
            page.drawText(dateStr, { x: colX[0], y, size: 10, font });
            page.drawText(typeStr, { x: colX[1], y, size: 10, font, color: isDebt ? rgb(0.8, 0, 0) : rgb(0, 0.6, 0) });
            page.drawText(amountStr, { x: colX[2], y, size: 10, font });
            
            // Truncate note if too long
            const truncatedNote = noteStr.length > 30 ? noteStr.substring(0, 27) + '...' : noteStr;
            page.drawText(truncatedNote, { x: colX[3], y, size: 10, font });

            // Image handling
            let rowHeight = 20;
            if (t.invoiceImageUrl) {
                try {
                    const response = await fetch(t.invoiceImageUrl);
                    if (!response.ok) throw new Error("Image fetch failed");
                    const imgBuffer = await response.arrayBuffer();

                    let image;
                    try {
                        image = await pdfDoc.embedJpg(imgBuffer);
                    } catch (e) {
                        image = await pdfDoc.embedPng(imgBuffer);
                    }

                    // Scale to fit 80x80
                    const dims = image.scaleToFit(80, 80);
                    
                    page.drawImage(image, {
                        x: colX[4],
                        y: y - dims.height + 8, 
                        width: dims.width,
                        height: dims.height,
                    });
                    rowHeight = Math.max(20, dims.height + 10);
                } catch (e) {
                    // console.error('Error embedding image:', e);
                    page.drawText('N/A', { x: colX[4], y, size: 10, font, color: rgb(0.6, 0.6, 0.6) });
                }
            } else {
                page.drawText('N/A', { x: colX[4], y, size: 10, font, color: rgb(0.6, 0.6, 0.6) });
            }

            y -= rowHeight;
            
            // Separator line
            page.drawLine({ start: { x: margin, y: y + 5 }, end: { x: width - margin, y: y + 5 }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });
            y -= 10;
        }

        // Totals Section
        y -= 20;
        if (y < margin + 60) {
            page = pdfDoc.addPage();
            y = height - margin;
        }

        page.drawLine({ start: { x: margin, y: y + 10 }, end: { x: width - margin, y: y + 10 }, thickness: 1, color: rgb(0, 0, 0) });
        page.drawText(`Total Debt: $${totalDebt.toFixed(2)}`, { x: margin, y, size: 12, font: boldFont });
        y -= 20;
        page.drawText(`Total Paid: $${totalPaid.toFixed(2)}`, { x: margin, y, size: 12, font: boldFont });
        y -= 20;
        page.drawText(`Balance: $${balance.toFixed(2)}`, { x: margin, y, size: 14, font: boldFont, color: balance > 0 ? rgb(0.8, 0, 0) : rgb(0, 0.6, 0) });

        const pdfBytes = await pdfDoc.save();

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "attachment; filename=statement.pdf");
        res.send(Buffer.from(pdfBytes));

    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

export default router;
