import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
  const page=await browser.newPage({viewport:{width:1200,height:640}});
  for(const name of ['nihao','overlay','strokes','basic-strokes']){
    await page.setContent(await readFile(`analysis/xingshu/artwork/${name}.svg`,'utf8'));
    await page.locator('svg').screenshot({path:`analysis/xingshu/artwork/${name}.png`});
  }
}finally{await browser.close();}
