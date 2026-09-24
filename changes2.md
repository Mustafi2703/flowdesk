We need significant ui updates in this 

1. we need proper colour coding , like orange bakck and may one more clour which goes with it or purple white and purple back or green balck anad white accrodidngly for them to choose form a,d show interactive charts a updates list and task list for teh candidates and ownere and maneger accroding to that differnt as per their best overview of the workflow the system not multiple random colours and the colours are too pastel , the left nav baor also aligned whtahta and dark maode whiremode porperly goign with the colours. so create ui options with proper colourin gcosing all throught ehe ap we need to share screen shot optiosn before we deploy 

2. brand routing messed up a little bit , remove the left list on teh brands page th routing should be proper from the work flow page. 

3.  brands dont have staeges liek assiened or anything only tasks , its too cartoonish right now we need it more proefesisonal the he whole css comepletlty  needs to be changed without breaking teh backend and lossign any data and for ligin apge it shodu ldyanamically alisn gofr all screensa adn mobile view as well.

4. the notifciaiton is iverlapping awith some pages the dashbaord and all so we need to amke sure that it is good, in white mode it bencoems greean danwhite we need to make sure we have prepr coour theme there .

5. Do all chanegs local and show and test everythign before depllpyign and make sure we dont loose any data. 

6. we need cleaner dsashboard weillt clear route to tasks.
7. we need depart ment wise colour coding for h eusers .
8. Taskview need to be more interactive.
9. Brand logo upload doenot need a review remove that, make sure we dont break teh exisitng review system.
10. recurrign tasks need to highlisgeted seprately , the dashbaord numbers need to be better shown.
11. under a brand if tasks a re assigned to multiple  people every person shoudld be able to see tha thjats in teh brands page for that particalu brnad if they want to route to that brand.

---

## Client chat (16 Sep) — product rules

- **Stages belong to tasks only**, not brands. Workflow dashboard filters and cards are task-centric (phase derived from task status + type).
- **Updates / chat**: show **brand name first**, then **active threads** under each brand so daily task volume does not bury thread names.
- **Close chat only** — no delete. Close keeps full history; task is done and no further chat is expected. Reopen available to owner/manager.
- **No delete in UI** for tasks, brands, or chat (data retention).
- **Google Drive / external links** on tasks for review (`external_links` on task detail → Files & links + Review tab).
- **Owner workflow view**: KPI row, team capacity % grid (red when overloaded), active task cards (brand, deliverables, phase, chat link) — see `/ui-mockups` workflow section and live `/workflow` page.
- **Sign-off**: share `/theme-options` + `/ui-mockups` screenshots; **revert or finalize chosen UI by Wednesday** (week of sign-off).

## Share URLs (local)

- http://localhost:3000/theme-options — **10 colour palettes** + **12 UI packages**; **login desktop+mobile mocks** per palette; sticky **Light/Dark**; workflow/capacity/campaigns match client refs; **same nav icons** as app; department colour chips
- **Brands (live app):** default tab **Tasks** → Projects → **Team** → Meetings → Summary → Goals → Journey → **Identity last** (no brand workflow stage in UI)
- http://localhost:3000/ui-mockups — three **owner** packages rendered full-page (Campaign Command recommended)
- http://localhost:3000/devboard — live workflow dashboard (after deploy: https://tasks.sfolks.com/…)
