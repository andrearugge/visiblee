### Contenuti importati da sitemap
[x] Status: DONE
Quando vengono importati i contenuti dalla sitemap, può essere che ci siano contenuti non in target rispetto alla lingua seleionata nel progetto.
Va inserito un controllo che da bassa affidabilità o cancella direttamente i contenuti non in lingua target del progetto.
Fix: `worker.py` — `process_sitemap_import_job` ora recupera `targetLanguage` dal progetto e, per ogni URL, rileva la lingua dal path segment o subdomain (es. `/en/`, `it.example.com`). Gli URL con lingua diversa da quella target vengono saltati. URL senza indicatori di lingua passano invariati.

### Wizard onboarding progetto
[x] Status: DONE
Il setup sembra non funzionare correttamente, mi resta ferma a step 1 di 3.
Per provarlo ho fatto un nuovo progetto (ID 91dd9e8b-2755-40d8-a63c-503ee50ab239), e nonostante abbia già fatto l'analisi full, mi dice sempre che sono allo step 1.
Fix: `setup-status` API ora include `hasSnapshot`. `SetupBanner` usa `hasSnapshot` per considerare il setup completo (e auto-dismissarsi) quando esiste almeno uno snapshot — indipendentemente da queryCount/contentCount/confirmedCount.

### Nuovo progetto
[x] Status: DONE
Quando creo un nuovo progetto ora mi vengono chieste le query. Considerando che al momento della creazione non ho ancora le query, non ha senso chiedere questo dato. Va tolto. Lo inserirei nella fase di onboarding successiva dove possiamo mostrare anche i suggerimenti di GSC, in quanto già collegato.
Fix: rimosso il campo textarea "Target Queries" da `new-project-form.tsx`. Il progetto viene creato senza query; l'utente le aggiunge successivamente dal wizard di onboarding (dove sono disponibili anche i suggerimenti GSC).

