async page => {
 const results=[];
 const ensurePlaying = async () => {
   try { await page.waitForFunction(()=>document.querySelector('[data-testid="music-scene"]').dataset.playing==='true',null,{timeout:5000}); }
   catch {
     await page.getByRole('button',{name:'播放音乐',exact:true}).click();
     await page.waitForFunction(()=>document.querySelector('[data-testid="music-scene"]').dataset.playing==='true');
     results.push('browser required another explicit play click after track selection');
   }
 };
 if(await page.getByTestId('music-scene').getAttribute('data-playing')!=='true')await page.getByRole('button',{name:'播放音乐',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-testid="music-scene"]').dataset.playing==='true');
 await page.getByRole('button',{name:'暂停音乐',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-testid="music-scene"]').dataset.playing==='false');results.push('real Spotify pause stops room animation');
 await page.getByRole('button',{name:'下一首',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-testid="spotify-embed"] iframe').src.includes('3OXHwY8gI2QUh0QliXBwrI'));results.push('real next track loads 愛, 很簡單');
 await page.getByRole('button',{name:'播放音乐',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-testid="music-scene"]').dataset.playing==='true');results.push('real Spotify playback_update starts record animation');
 await page.getByRole('button',{name:'下一首',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-testid="spotify-embed"] iframe').src.includes('0ZkoOzNcWkxXaeWzuBFWPU'));
 await ensurePlaying();results.push('next track plays through official iframe');
 await page.getByRole('button',{name:'上一首',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-testid="spotify-embed"] iframe').src.includes('3OXHwY8gI2QUh0QliXBwrI'));results.push('previous track changes real iframe');
 await page.getByRole('button',{name:'夜晚',exact:true}).click();
 const night=await page.getByTestId('music-scene').getAttribute('data-light');
 const frame=page.frameLocator('[data-testid="spotify-embed"] iframe');
 const text=await frame.locator('body').innerText();
 await page.getByTestId('music-room').screenshot({path:'.artifacts/music-real.png'});
 if(await page.getByTestId('music-scene').getAttribute('data-playing')==='true')await page.getByRole('button',{name:'暂停音乐',exact:true}).click();
 return {results,night,iframeText:text.slice(0,1800),external:await page.getByRole('link',{name:'平台完整版'}).getAttribute('href')};
}
