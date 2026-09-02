const fs = require('fs'); 
const data = JSON.parse(fs.readFileSync('alpha_results.json')); 
data.forEach(d => { 
  if (d.result && d.result.stats) { 
    const s = d.result.stats; 
    console.log(`${d.name}: In: ${(s.inputBytes/1024).toFixed(1)}KB, Out: ${(s.outputBytes/1024).toFixed(1)}KB, Saved: ${s.savedPercent.toFixed(1)}%, Time: ${Math.round(s.processingTimeMs)}ms, Img(D/M/S): ${s.imagesDetected}/${s.imagesModified}/${s.imagesSkipped}`); 
  } else { 
    console.log(`${d.name}: ${d.status}`); 
  } 
});
