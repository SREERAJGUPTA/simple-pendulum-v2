from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 c=b.new_context(viewport={'width':1440,'height':900},offline=True,reduced_motion='no-preference')
 page=c.new_page();page.set_default_timeout(5000);page.set_content((R/'Time-in-Motion-Sakura.html').read_text(),wait_until='load');page.get_by_role('heading',name='Time in motion.').wait_for()
 page.get_by_role('button',name='Pause simulation',exact=True).click()
 page.get_by_role('button',name='Restart',exact=True).click()
 page.evaluate('window.scrollTo({top:0,behavior:"instant"})');page.wait_for_timeout(700)
 page.screenshot(path=str(R/'verification/sakura-preview.png'))
 print('Captured actual fallback UI with ambient petals.')
 b.close()
