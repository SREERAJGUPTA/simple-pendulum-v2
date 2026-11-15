from pathlib import Path
from playwright.sync_api import sync_playwright
import json
R=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':1440,'height':1000},reduced_motion='reduce');page.set_default_timeout(5000)
 print('LOAD',flush=True);page.set_content((R/'Time-in-Motion-Sakura.html').read_text(),wait_until='load');page.get_by_role('heading',name='Time in motion.').wait_for()
 for name,val in [('L','.25'),('g','25'),('Releaseangle','5'),('Damping','0')]:
  f=page.locator('#parameter-'+name);f.fill(val);f.press('Enter');print(name,flush=True)
 print('rate before',page.locator('.speed-control').inner_text(),flush=True)
 page.get_by_role('button',name='0.25\u00d7',exact=True).click();print('rate .25 set',flush=True)
 page.get_by_role('button',name='1\u00d7',exact=True).click();print('rate 1 set',flush=True)
 page.locator('#cycle-count').select_option('20');print('20 selected',flush=True)
 page.get_by_role('button',name='Measure 20 oscillations',exact=True).click();print('start',flush=True)
 page.get_by_role('button',name='Record trial',exact=True).wait_for(timeout=20000)
 print('result',page.locator('.period-result').inner_text(),page.locator('.measurement-controls').inner_text(),flush=True)
 b.close()
