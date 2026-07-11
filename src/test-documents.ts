import { generateInvoicePdf } from "./documents/invoice";
import { generateAnalysisDeck } from "./documents/deck";

// Use a bill_id you know is finalized from earlier testing — adjust if needed
const pdfPath = generateInvoicePdf(1);
console.log("PDF created:", pdfPath);

const pptxPath = generateAnalysisDeck();
console.log("PPTX created:", pptxPath);