// /api/submit-estimate.js
// Handles Webflow form submission and sends estimate emails

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Fields to exclude (functional fields, not user selections)
const FUNCTIONAL_FIELDS = [
  "Angebot", // This is the hidden textarea with summary
  "chat_transcript", // Chat transcript if exists
];

// Group mapping: form field names to display groups
const GROUP_MAPPING = {
  "Empfangspauschale": "Empfangspauschale",
  "drink": "Getränke",
  "speisekarte": "Menüvorschläge",
  "Mini-Blätterteig-Häppchen": "Kleiner Häppchen zum Empfang",
  "Mini-Blätterteig-Häppchen-2": "Kaffeepauschale",
  "Mini-Blätterteig-Häppchen-3": "Mitternachtssnack",
  // Combo items (cakes, ceremony, extras) - will be detected by data-group="combo"
};

// Price calculation helper
function calculateItemTotal(price, guests, quantity = 1, isPerPerson = true) {
  const priceNum = parseFloat(price) || 0;
  if (isPerPerson) {
    return priceNum * guests * quantity;
  }
  return priceNum * quantity;
}

// Parse form data and organize by groups
function parseFormData(formData) {
  // Try multiple variations of the date field name (handles encoding issues)
  const dateField = formData["Wunschtermin-für-Hochzeit"] || 
                    formData["Wunschtermin-f-r-Hochzeit"] || 
                    formData["Wunschtermin-fuer-Hochzeit"] ||
                    formData["Wunschtermin-f-r-Hochzeit"] ||
                    formData.date || 
                    formData.Date ||
                    "";
  
  const userInfo = {
    name: formData.Name || formData.name || "",
    email: formData.Email || formData.email || "",
    phone: formData.Telefonnumer || formData.phone || formData.Telefon || "",
    date: dateField,
    guests: parseInt(formData["Gäste"] || formData.guests || formData["number-of-guests"] || formData["G-ste"] || "10", 10),
  };

  // Get summary text from Angebot field
  const summaryText = formData.Angebot || "";

  // Try to parse structured JSON data from estimate-data-json field
  let estimateData = null;
  try {
    const jsonData = formData["estimate-data-json"] || formData["estimate_data_json"];
    if (jsonData) {
      estimateData = JSON.parse(jsonData);
      // Override guests from structured data if available
      if (estimateData.guests) {
        userInfo.guests = estimateData.guests;
      }
    }
  } catch (e) {
    console.warn("Could not parse estimate JSON data:", e.message);
  }

  return { userInfo, estimateData, summaryText };
}

// Generate HTML email template
function generateEmailHTML(userInfo, estimateData, summaryText, total) {
  const guestCount = userInfo.guests || 10;
  const finalTotal = total || (estimateData?.total || 0);

  // Build grouped table from structured data
  let groupsHTML = "";
  
  if (estimateData && estimateData.groups) {
    // Use structured data for accurate table
    for (const [groupName, items] of Object.entries(estimateData.groups)) {
      if (!items || items.length === 0) continue;

      let itemsHTML = "";
      
        items.forEach(item => {
        const priceText = item.priceText || "-";
        let quantity = guestCount;
        let totalText = "-";
        
        // Calculate total based on item type
        if (item.isPerPerson && item.pricePerUnit > 0) {
          const total = item.pricePerUnit * guestCount;
          totalText = `${total.toFixed(2)} €`;
        } else if (item.isPerPiece && item.pricePerUnit > 0) {
          quantity = 1; // Per piece items
          totalText = `${item.pricePerUnit.toFixed(2)} €`;
        } else if (item.total > 0) {
          // Use pre-calculated total
          totalText = `${item.total.toFixed(2)} €`;
          // For guest count, don't show quantity
          if (item.name.includes("Gäste")) {
            quantity = item.total;
          }
        }
        
        itemsHTML += `
          <tr>
            <td style="color: #333333 !important;">${item.name}</td>
            <td style="text-align: center; color: #333333 !important;">${quantity}</td>
            <td style="text-align: right; color: #333333 !important;">${priceText}</td>
            <td style="text-align: right; font-weight: ${item.total > 0 ? 'bold' : 'normal'}; color: #333333 !important;">${totalText}</td>
          </tr>
        `;
      });

      groupsHTML += `
        <tr>
          <td colspan="4" style="background: #f8f9fa; font-weight: bold; padding: 12px; border-top: 2px solid #ddd;">${groupName}</td>
        </tr>
        ${itemsHTML}
      `;
    }
  } else if (summaryText && summaryText.trim()) {
    // Fallback: use summary text as formatted content
    groupsHTML = `
      <tr>
        <td colspan="4" style="padding: 20px; white-space: pre-wrap; font-family: monospace; font-size: 14px;">${summaryText.replace(/\n/g, "<br>")}</td>
      </tr>
    `;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>
    /* Force light mode */
    :root { color-scheme: light; }
    body { 
      font-family: Arial, sans-serif; 
      line-height: 1.6; 
      color: #333333 !important; 
      background-color: #ffffff !important;
      max-width: 800px; 
      margin: 0 auto; 
      padding: 20px; 
    }
    .container { 
      background: #ffffff !important; 
      padding: 30px; 
      border-radius: 8px; 
      box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
    }
    .header { 
      background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%) !important; 
      color: #ffffff !important; 
      padding: 25px; 
      border-radius: 8px; 
      margin-bottom: 30px; 
    }
    .header h1 { 
      margin: 0 0 20px 0; 
      font-size: 24px; 
      color: #ffffff !important;
    }
    .info-row { 
      margin: 10px 0; 
      padding: 8px 0; 
      border-bottom: 1px solid rgba(255,255,255,0.2); 
    }
    .info-label { 
      font-weight: bold; 
      display: inline-block; 
      width: 160px; 
      color: #ffffff !important;
    }
    .info-value { 
      color: #ffffff !important; 
    }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin: 30px 0; 
      background: #ffffff !important; 
    }
    th { 
      background: #2c3e50 !important; 
      color: #ffffff !important; 
      padding: 12px; 
      text-align: left; 
      font-weight: 600; 
    }
    th:last-child, td:last-child { 
      text-align: right; 
    }
    th:nth-child(2) { 
      text-align: center; 
    }
    td { 
      padding: 12px; 
      border-bottom: 1px solid #eeeeee; 
      color: #333333 !important;
      background: #ffffff !important;
    }
    tr:last-child td { 
      border-bottom: none; 
    }
    .total-row { 
      background: #f8f9fa !important; 
      font-weight: bold; 
    }
    .total { 
      font-size: 28px; 
      font-weight: bold; 
      color: #2c3e50 !important; 
      margin: 30px 0; 
      padding: 20px; 
      background: #f8f9fa !important; 
      border-radius: 8px; 
      text-align: center; 
      border: 2px solid #2c3e50; 
    }
    .footer { 
      margin-top: 40px; 
      padding-top: 20px; 
      border-top: 2px solid #eeeeee; 
      color: #666666 !important; 
      font-size: 14px; 
      text-align: center; 
    }
    .footer strong { 
      color: #2c3e50 !important; 
    }
    .footer p {
      color: #666666 !important;
      margin: 5px 0;
    }
    .disclaimer { 
      margin-top: 20px; 
      font-size: 12px; 
      color: #999999 !important; 
      font-style: italic; 
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Hochzeits-Angebot</h1>
      <div class="info-row">
        <span class="info-label">Name:</span>
        <span class="info-value">${userInfo.name || "Nicht angegeben"}</span>
      </div>
      <div class="info-row">
        <span class="info-label">E-Mail:</span>
        <span class="info-value">${userInfo.email || "Nicht angegeben"}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Telefon:</span>
        <span class="info-value">${userInfo.phone || "Nicht angegeben"}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Wunschtermin:</span>
        <span class="info-value">${userInfo.date || "Nicht angegeben"}</span>
      </div>
      <div class="info-row" style="border-bottom: none;">
        <span class="info-label">Anzahl Gäste:</span>
        <span class="info-value">${guestCount}</span>
      </div>
    </div>
    
    <table>
      <thead>
        <tr>
          <th>Artikel</th>
          <th>Gäste</th>
          <th>Preis p.P./St.</th>
          <th>Gesamt</th>
        </tr>
      </thead>
      <tbody>
        ${groupsHTML}
      </tbody>
    </table>
    
    <div class="total">Gesamtpreis: ${finalTotal.toFixed(2)} €</div>
    
    <div class="footer">
      <p><strong>Königswirt im Trachtenheim</strong></p>
      <p>Donauwörther Str. 46, 86343 Königsbrunn</p>
      <p>Tel: 08-231-86000 | E-Mail: info@koenigswirt-th.de</p>
      <div class="disclaimer">
        Dies ist eine automatisch generierte Kostenschätzung. Für ein finales Angebot kontaktieren Sie uns bitte persönlich.
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Check for Resend API key
    if (!process.env.RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return res.status(500).json({ error: "Email service not configured" });
    }

    // Get owner email and from email from env
    const ownerEmail = process.env.OWNER_EMAIL || "info@koenigswirt-th.de";
    // Use verified domain koenigswirt-th.de (not send.koenigswirt-th.de subdomain)
    const fromEmail = process.env.FROM_EMAIL || "noreply@koenigswirt-th.de";
    
    console.log('Using from email:', fromEmail);

    // Parse form data
    const formData = req.body;
    console.log('Received form data keys:', Object.keys(formData));
    console.log('User email from form:', formData.Email || formData.email);
    
    // Log date field variations for debugging
    const dateVariations = {
      "Wunschtermin-für-Hochzeit": formData["Wunschtermin-für-Hochzeit"],
      "Wunschtermin-f-r-Hochzeit": formData["Wunschtermin-f-r-Hochzeit"],
      "Wunschtermin-fuer-Hochzeit": formData["Wunschtermin-fuer-Hochzeit"],
      "date": formData.date,
      "Date": formData.Date
    };
    console.log('Date field variations:', dateVariations);
    
    const { userInfo, estimateData, summaryText } = parseFormData(formData);
    console.log('Parsed user info:', { 
      name: userInfo.name, 
      email: userInfo.email, 
      phone: userInfo.phone,
      date: userInfo.date,
      guests: userInfo.guests 
    });

    // Validate required fields
    if (!userInfo.email) {
      console.error('Email validation failed - no email found');
      return res.status(400).json({ error: "Email is required", receivedData: Object.keys(formData) });
    }

    // Get total from structured data or form field
    const total = estimateData?.total || parseFloat(formData.total || formData["data-text-total"] || "0") || 0;

    // Generate HTML email
    const htmlContent = generateEmailHTML(userInfo, estimateData, summaryText, total);

    // Send email to user
    console.log('Sending email to user:', userInfo.email);
    console.log('From email:', fromEmail);
    let userEmailResult;
    try {
      userEmailResult = await resend.emails.send({
        from: fromEmail,
        to: userInfo.email,
        subject: `Ihr Hochzeits-Angebot / Your Wedding Estimate - ${userInfo.name || "Hochzeit"}`,
        html: htmlContent,
      });
      console.log('User email result:', JSON.stringify(userEmailResult, null, 2));
      console.log('User email sent - ID:', userEmailResult.data?.id || userEmailResult.id || 'No ID returned');
      
      // Check if email was actually sent
      if (userEmailResult.error) {
        console.error('Resend API error for user email:', userEmailResult.error);
        throw new Error(`Resend API error: ${JSON.stringify(userEmailResult.error)}`);
      }
    } catch (emailError) {
      console.error('Error sending user email:', emailError);
      console.error('Error details:', emailError.response || emailError.message);
      throw new Error(`Failed to send user email: ${emailError.message}`);
    }

    // Send email to owner
    console.log('Sending email to owner:', ownerEmail);
    let ownerEmailResult;
    try {
      ownerEmailResult = await resend.emails.send({
        from: fromEmail,
        to: ownerEmail,
        subject: `Neue Hochzeitsanfrage von ${userInfo.name || "Unbekannt"}`,
        html: htmlContent,
        replyTo: userInfo.email, // So owner can reply directly
      });
      console.log('Owner email result:', JSON.stringify(ownerEmailResult, null, 2));
      console.log('Owner email sent - ID:', ownerEmailResult.data?.id || ownerEmailResult.id || 'No ID returned');
      
      // Check if email was actually sent
      if (ownerEmailResult.error) {
        console.error('Resend API error for owner email:', ownerEmailResult.error);
        throw new Error(`Resend API error: ${JSON.stringify(ownerEmailResult.error)}`);
      }
    } catch (emailError) {
      console.error('Error sending owner email:', emailError);
      console.error('Error details:', emailError.response || emailError.message);
      throw new Error(`Failed to send owner email: ${emailError.message}`);
    }

    // Return JSON for AJAX form submission (will be handled by frontend)
    return res.status(200).json({
      ok: true,
      message: "Estimate sent successfully",
      userEmailId: userEmailResult.data?.id,
      ownerEmailId: ownerEmailResult.data?.id,
    });

  } catch (error) {
    console.error("Submit estimate error:", error);
    return res.status(500).json({
      error: "Failed to send estimate",
      message: error.message,
    });
  }
}

