require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { OUTPUTS_DIR, listQuotes } = require('../lib/storage');
const { generatePDFWithPDFKit } = require('../utils/pdf');

async function regen(file){
  const outputs = OUTPUTS_DIR;
  const jsonPath = path.join(OUTPUTS_DIR, file);
  if(!fs.existsSync(jsonPath)){
    console.error('JSON not found:', jsonPath);
    process.exit(2);
  }
  const data = JSON.parse(fs.readFileSync(jsonPath,'utf8'));
  const pdfDir = path.join(OUTPUTS_DIR, 'pdfs');
  if(!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
  const outPdf = path.join(pdfDir, file.replace('.json','.pdf'));
  try{
    await generatePDFWithPDFKit(data, outPdf);
    console.log('Wrote', outPdf);
  }catch(err){
    console.error('Error generating PDF', err);
    process.exit(3);
  }
}

async function regenerateAllPDFs(){
  console.log('🔄 Iniciando regeneración de todos los PDFs...');
  
  const quotes = listQuotes();
  if(quotes.length === 0){
    console.log('❌ No se encontraron cotizaciones para regenerar');
    return;
  }

  console.log(`📄 Encontradas ${quotes.length} cotizaciones:`);
  quotes.forEach(q => console.log(`  - ${q.file}`));

  const pdfDir = path.join(OUTPUTS_DIR, 'pdfs');
  if(!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

  let successCount = 0;
  let errorCount = 0;

  for(const quote of quotes){
    try{
      const data = JSON.parse(fs.readFileSync(quote.path, 'utf8'));
      const outPdf = path.join(pdfDir, quote.file.replace('.json','.pdf'));
      
      await generatePDFWithPDFKit(data, outPdf);
      console.log(`✅ Regenerado: ${quote.file} → ${path.basename(outPdf)}`);
      successCount++;
    }catch(err){
      console.error(`❌ Error regenerando ${quote.file}:`, err.message);
      errorCount++;
    }
  }

  console.log('\n📊 Resumen de regeneración:');
  console.log(`  ✅ Exitosos: ${successCount}`);
  console.log(`  ❌ Errores: ${errorCount}`);
  console.log(`  📄 Total: ${quotes.length}`);
  
  if(successCount > 0){
    console.log('\n🎉 ¡Regeneración completada! Los PDFs han sido actualizados con el nuevo diseño.');
  }
}

// Main execution
const command = process.argv[2];
const file = process.argv[3];

if(command === 'all' || command === '--all'){
  regenerateAllPDFs().catch(err => {
    console.error('Error en regeneración masiva:', err);
    process.exit(1);
  });
} else if(file){
  regen(file);
} else {
  console.log('Uso:');
  console.log('  node regenerate_pdf.js <file.json>     - Regenerar un PDF específico');
  console.log('  node regenerate_pdf.js all             - Regenerar todos los PDFs');
  console.log('  node regenerate_pdf.js --all           - Regenerar todos los PDFs');
  process.exit(1);
}
