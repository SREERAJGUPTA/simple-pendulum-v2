"""Browser checks against the exact standalone HTML bytes.
The managed browser blocks URL navigation, including localhost and file URLs.
set_content renders the packaged artifact without network; this does NOT prove
hosted routing, service-worker installation, native storage or WebGL support.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,time,re,os
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'verification'; html=(ROOT/'Time-in-Motion-Sakura.html').read_text()
SECTION=os.environ.get('QA_SECTION','all')
checks=[]; errors=[]; requests=[]; periods=[]
def check(name,condition,detail=''):
 checks.append({'name':name,'status':'passed' if condition else 'failed','detail':detail});print(('PASS ' if condition else 'FAIL ')+name,flush=True)
 if not condition: raise AssertionError(name+' '+detail)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 c=b.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1,reduced_motion='reduce',offline=True,accept_downloads=True)
 page=c.new_page();page.set_default_timeout(10000);page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
 page.set_content(html,wait_until='load');page.get_by_role('heading',name='Time in motion.').wait_for()
 page.wait_for_timeout(250)
 check('Initial page loads without uncaught JavaScript errors',not errors,str(errors))
 check('Reduced-motion preference starts the pendulum paused',page.get_by_role('button',name='Play simulation',exact=True).is_visible())
 renderers=page.locator('[data-renderer]').evaluate_all('(es)=>es.map(e=>e.dataset.renderer)')
 check('Working diagram automatically replaces unavailable WebGL',renderers==['svg','svg'],str(renderers))
 check('Perspective is unavailable rather than a dead control in diagram mode',page.get_by_role('button',name='Perspective',exact=True).is_disabled())
 def value(id,v):
  field=page.locator('#parameter-'+id);field.fill(str(v));field.press('Enter');page.wait_for_timeout(110)
 value('L',-1)
 check('Invalid length is rejected visibly',page.locator('#parameter-L').get_attribute('aria-invalid')=='true')
 value('L',.5);value('g',9.81);value('Releaseangle',5);value('Damping',0)
 check('Valid control value clears the error',page.locator('#parameter-L').get_attribute('aria-invalid')=='false')
 page.locator('#cycle-count').select_option('1')
 if SECTION in ['all','measurement']:
  for length in [.5,1,1.5]:
   value('L',length)
   page.get_by_role('button',name='Measure 1 oscillation',exact=True).click()
   page.get_by_role('button',name='Record trial',exact=True).wait_for(state='visible',timeout=15000)
   period=float(page.locator('.period-result strong').inner_text().replace('s','').strip());periods.append({'length':length,'period':period})
   page.get_by_role('button',name='Record trial',exact=True).click()
   check('Measurement and notebook recording at '+str(length)+' m',page.locator('.observation-scroll tbody tr').count()==len(periods),str(period))
   check('A completed measurement pauses the simulation',page.get_by_role('button',name='Play simulation',exact=True).is_visible())
   check('Duplicate record is disabled',page.get_by_role('button',name='Recorded',exact=True).is_disabled())
  check('Gravity inferred from three measured periods', '9.80' in page.locator('.inference-result').inner_text(),page.locator('.inference-result').inner_text())
  page.get_by_role('button',name='T vs \u221aL',exact=True).click()
  check('Alternative linearized fit works', 'g from this fit:' in page.locator('.notebook-graph').inner_text())
  page.get_by_role('button',name='L vs T',exact=True).click()
  check('Nonlinear notebook view does not invent a straight-line fit', 'relationship is curved' in page.locator('.notebook-graph').inner_text())
  page.get_by_role('button',name='T\u00b2 vs L',exact=True).click()
  page.locator('.uncertainty-lens summary').click()
  check('Uncertainty calculator uses the measured trial',page.locator('.uncertainty-lens .calculated-value').is_visible())
  with page.expect_download() as d:
   page.get_by_role('button',name='Export CSV',exact=True).click()
  download=d.value;download.save_as(OUT/'observations-test.csv')
  lines=(OUT/'observations-test.csv').read_text().strip().splitlines()
  check('CSV export contains three genuine observations with units',len(lines)==4 and 'elapsed_simulated_s' in lines[0])
  page.locator('#notebook').evaluate('(el)=>el.scrollIntoView({block:"start"})');page.wait_for_timeout(80);page.screenshot(path=str(OUT/'notebook.png'))
  page.get_by_role('button',name='Clear notebook',exact=True).click();check('Clear notebook removes session rows',page.locator('.observation-scroll tbody tr').count()==0)
  page.get_by_role('button',name='Undo clear',exact=True).click();check('Undo restores recorded rows',page.locator('.observation-scroll tbody tr').count()==3)
  # Slow-motion measurement uses simulation seconds.
  value('L',.25);value('g',25)
  page.get_by_role('button',name='0.25\u00d7',exact=True).click()
  page.get_by_role('button',name='Measure 1 oscillation',exact=True).click()
  page.get_by_role('button',name='Record trial',exact=True).wait_for(state='visible',timeout=15000)
  slow=float(page.locator('.period-result strong').inner_text().replace('s','').strip())
  check('Quarter-speed timing preserves the period',abs(slow-.628618)<.001,str(slow))
 if SECTION in ['all','interface']:
  # Exact step and keyboard non-drag control.
  page.get_by_role('button',name='Restart',exact=True).click();page.wait_for_timeout(110)
  before=page.locator('.live-readouts>div').nth(2).inner_text()
  page.get_by_role('button',name='Step',exact=True).click();page.wait_for_timeout(150)
  check('Single-step advances 0.05 simulated seconds','0.05' in page.locator('.live-readouts>div').nth(2).inner_text(),before)
  value('L',1.2);value('g',9.81);value('Releaseangle',30)
  bob=page.get_by_role('button',name='Pendulum bob. Drag to set the release angle, or use the arrow keys.',exact=True)
  bob.focus();bob.press('Enter');bob.press('ArrowRight');page.wait_for_timeout(80)
  check('Keyboard hold and adjust sets a new release angle',abs(float(page.locator('#parameter-Releaseangle').input_value())-31)<.01)
  bob.press('Enter');page.wait_for_timeout(120)
  check('Keyboard release starts the pendulum',page.get_by_role('button',name='Pause simulation',exact=True).is_visible())
  page.get_by_role('button',name='Pause simulation',exact=True).click();page.wait_for_timeout(100)
  box=bob.bounding_box();page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);page.mouse.down();page.mouse.move(box['x']+box['width']/2-55,box['y']+box['height']/2,steps=10);page.mouse.up();page.wait_for_timeout(140)
  check('Pointer drag and release works',page.get_by_role('button',name='Pause simulation',exact=True).is_visible())
  page.get_by_role('button',name='Pause simulation',exact=True).click()
  page.get_by_role('button',name='Advanced mechanics',exact=True).click()
  page.get_by_label('Small-angle ghost',exact=True).check();page.wait_for_timeout(100)
  check('Ghost comparison appears without replacing the nonlinear model', 'linearized model' in page.locator('.comparison-note').inner_text())
  check('Live mechanics inspector is present',page.get_by_role('region',name='Live mechanics inspector').is_visible())
  for mode in ['energy','angle','velocity','acceleration','phase','decay']:
   page.get_by_label('Graph view',exact=True).select_option(mode)
   check(mode+' graph is rendered',page.locator('.graph-card svg[role="img"]').is_visible())
  page.get_by_label('Graph view',exact=True).select_option('angle')
  # Actual state presets, not invented observations.
  page.get_by_role('button',name=re.compile('When swinging stops')).click();page.wait_for_timeout(150)
  check('Overdamped preset blocks periodic measurement',page.get_by_role('button',name='Measure 10 oscillations',exact=True).is_disabled())
  check('Guided tasks preserve the notebook',page.locator('.observation-scroll tbody tr').count()==(3 if SECTION=='all' else 0))
  page.get_by_role('button',name=re.compile('Break the approximation')).click();page.wait_for_timeout(150)
  check('Large-angle preset sets 70 degrees',page.locator('#parameter-Releaseangle').input_value()=='70.0')
  page.get_by_role('tab',name='Test your intuition').click()
  page.locator('.answer-options button').nth(1).click();check('Incorrect answer receives corrective feedback','Reconsider' in page.locator('.answer-feedback').inner_text())
  page.locator('.answer-options button').nth(0).click();check('Corrected answer receives positive feedback','That follows' in page.locator('.answer-feedback').inner_text())
  page.get_by_role('tab',name='The mechanics',exact=True).click();page.keyboard.press('ArrowRight')
  check('Learning tabs support arrow-key navigation',page.get_by_role('tab',name='The real-lab bridge').get_attribute('aria-selected')=='true')
  page.get_by_role('tab',name='Grade 12 & beyond',exact=True).click()
  charge=page.get_by_role('slider',name=re.compile('Charge on bob'));charge.fill('0');page.wait_for_timeout(100)
  check('Zero charge restores ordinary pendulum period','2.006 s' in page.locator('.mini-readouts').inner_text())
  page.get_by_role('slider',name='Drive / natural frequency1.00').count() # read only; labels vary with output.
  page.get_by_role('slider',name=re.compile('Damping ratio')).fill('0.8');page.wait_for_timeout(100)
  check('Strong damping removes the finite-frequency displacement peak','No nonzero-frequency' in page.locator('.resonance-study').inner_text())
  page.locator('#field-notes').evaluate('(el)=>el.scrollIntoView({block:"start"})');page.screenshot(path=str(OUT/'grade12.png'))
  # Capture settled desktop views.
  page.get_by_role('tab',name='The mechanics',exact=True).click();value('Releaseangle',30);value('Damping',0);page.get_by_label('Small-angle ghost',exact=True).uncheck();page.get_by_role('button',name='Explore',exact=True).click()
  page.evaluate('window.scrollTo(0,0)');page.screenshot(path=str(OUT/'hero.png'))
  page.locator('#laboratory').evaluate('(el)=>el.scrollIntoView({block:"start"})');page.screenshot(path=str(OUT/'laboratory.png'))
  check('No page-wide overflow on desktop',page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
 c.close()
 if SECTION in ['all','interface']:
  # Mobile-sized viewport with touch capability, content bytes in a fresh context.
  mc=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,reduced_motion='reduce',offline=True)
  mp=mc.new_page();mp.set_default_timeout(10000);mp.on('pageerror',lambda e:errors.append(str(e)));mp.set_content(html,wait_until='load');mp.get_by_role('heading',name='Time in motion.').wait_for();mp.wait_for_timeout(150)
  for width in [390,340]:
   mp.set_viewport_size({'width':width,'height':844});mp.wait_for_timeout(100)
   check('No page-wide horizontal overflow at '+str(width)+' CSS px',mp.evaluate('document.documentElement.scrollWidth <= innerWidth'),str(mp.evaluate('document.documentElement.scrollWidth')))
   mp.locator('#laboratory').evaluate('(el)=>el.scrollIntoView({block:"start"})');mp.screenshot(path=str(OUT/('mobile-'+str(width)+'.png')))
   mp.get_by_role('button',name='Advanced mechanics',exact=True).click();mp.get_by_label('Graph view',exact=True).select_option('phase');mp.get_by_role('tab',name='Grade 12 & beyond').click();mp.wait_for_timeout(80)
   check('Advanced layer reflows at '+str(width)+' px',mp.evaluate('document.documentElement.scrollWidth <= innerWidth'))
   mp.locator('#field-notes').evaluate('(el)=>el.scrollIntoView({block:"start"})');mp.screenshot(path=str(OUT/('mobile-study-'+str(width)+'.png')))
  check('No uncaught JavaScript errors across all workflows',not errors,str(errors))
  check('Standalone runtime needs no HTTP or HTTPS requests',not [r for r in requests if r.startswith(('http:','https:'))],str([r for r in requests if r.startswith(('http:','https:'))]))
 b.close()
report={'method':'Headless Chromium set_content of exact standalone artifact, offline network context; SVG fallback','limitations':['WebGL context unavailable','Managed browser prevents localhost and file navigation','Native storage and hosted service-worker operation not browser-verified','No physical touch-device or GPU performance validation'],'periods':periods,'checks':checks,'passed':sum(x['status']=='passed' for x in checks),'total':len(checks),'uncaughtErrors':errors}
(OUT/('browser-'+SECTION+'.json')).write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
