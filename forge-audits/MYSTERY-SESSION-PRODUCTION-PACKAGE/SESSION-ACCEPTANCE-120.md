# 120 normative Production-Acceptance Cases

| ID | Fall | Erwartung |
|---|---|---|
| A01 | Truth unbekanntes Rootfeld | SHAPE; keine Packageausgabe |
| A02 | Solution falscher truthHash | BINDING vor Folgeprüfung |
| A03 | Access fremder Case | BINDING |
| A04 | Presentation stale truthHash | BINDING |
| A05 | Catalogue anderer Truthstand | BINDING |
| A06 | NPC-Profil falscher catalogueHash | BINDING |
| A07 | Snapshot andere solutionHash | BINDING |
| A08 | Snapshot/Profil verschiedene npcId | BINDING |
| A09 | Doppeltes NPC-Paar | REFERENCE |
| A10 | NPC nicht in Truth.persons | REFERENCE |
| A11 | Initialref unbekannte Entity | REFERENCE |
| A12 | Initialref falsche Art | REFERENCE |
| A13 | Doppelte initial known | SHAPE/REFERENCE |
| A14 | Initial bekannte Evidence | Known, aber keine Discovery/Observation |
| A15 | Leeres initial known | gültig; keine automatische Freigabe |
| A16 | Refsource falscher caseId | REF_MAPPING |
| A17 | Refsource falscher truthHash | REF_MAPPING |
| A18 | Refsource salt 31/33 Hexzeichen | SHAPE |
| A19 | Ref fehlt für eine verborgene Entity | REF_MAPPING |
| A20 | Zwei Entities gleicher Token | REF_MAPPING |
| A21 | Refinverse andere Art/ID | REF_MAPPING |
| A22 | Ref syntaktisch ungültig | REF_MAPPING |
| A23 | Source nach Resolve verändert | bestehendes Package unverändert |
| A24 | Snapshot private Provenance geändert | snapshotHash und packageHash ändern |
| A25 | Snapshot asOf/revision geändert | packageHash ändert |
| A26 | Challenge Scope hinzugefügt | packageHash ändert |
| A27 | Nur Scope-Reihenfolge geändert | Hash gleich |
| A28 | Known-Reihenfolge geändert | Hash gleich |
| A29 | Witness-Schritte vertauscht | proofHash/packageHash ändern |
| A30 | Proof binding.releaseHash falsch | PROOF_BINDING |
| A31 | Manifest releaseContextHash falsch | PROOF_BINDING |
| A32 | Manifest executable JS als String | nie ausführen; nur Daten; keine PASS-Behauptung |
| A33 | proof null | technisches Package zulässig; Slice-Publikation noch nicht zertifiziert |
| A34 | proof pass-artiges Zusatzflag | Schemafehler; keine abgeleitete Autorität |
| A35 | Presentation ein Leerzeichen verändert | packageHash ändert |
| A36 | Salt verändert bei gleichem Mapping | refsHash/packageHash ändern |
| A37 | Mapping verändert bei gleicher Config | refsHash/packageHash ändern |
| A38 | 257 Entities oder 65 Evidence | LIMIT |
| A39 | Package über 2MiB/Depth32/100000 Nodes | LIMIT vor Domainparse |
| A40 | ResolvedPackage JSON.stringify | wirft; Public DTO bleibt serialisierbar |
| B01 | Verfügbaren Ort untersuchen | akzeptiert; passende Evidence released |
| B02 | Validen unbekannten Ort raten | ACTION_UNAVAILABLE |
| B03 | Nicht existierenden Ref raten | derselbe öffentliche Fehler |
| B04 | Item als search_location | ACTION_UNAVAILABLE |
| B05 | Bekannte Person ohne Evidence untersuchen | akzeptiert; leere Ausgabe |
| B06 | Gleichen Ort zweimal durchsuchen | zwei Events, nur erste Discovery/Observation |
| B07 | Mehrere Evidence bei einem Fund | öffentliche Ref-Sortierung, atomare Übernahme |
| B08 | Zweiter Evidence-Release fehlschlägt | HOST_FAILURE, kompletter Rollback |
| B09 | Evidence.source ohne Accesspfad | kein impliziter Fund |
| B10 | Neues Item durch Evidence mention | Known; Untersuchung erst im nächsten Event |
| B11 | Report-Claim mit nicht autorisiertem Ref | HOST_FAILURE, keine automatische Known-Erweiterung |
| B12 | Bekannte Evidence nur erwähnt | keine physische Discovery |
| B13 | NPC-Frage verfügbar | exakter 5B-Output plus Empfangsprovenance |
| B14 | Frage über unbekannte Person | ACTION_UNAVAILABLE; kein Existenzorakel |
| B15 | Unbekannte questionId | derselbe öffentliche Fehler |
| B16 | Bekannte Person ohne NPC-Profil | ACTION_UNAVAILABLE |
| B17 | NPC decline | akzeptiertes Event; kein Statement erfunden |
| B18 | NPC does_not_know | akzeptiert; keine Mentions erfunden |
| B19 | NPC false belief | als Report erhalten; kein objective truth |
| B20 | NPC uncertain | genaue Stance; keine Boolean-Konversion |
| B21 | Gleiche Frage wiederholen | gleicher Payload, zwei Records mit verschiedenen eventIndex |
| B22 | Widersprüchliche NPC-Berichte | beide erhalten; kein Last-writer-wins-Fakt |
| B23 | NPC kennt mehr als Spieler | nur explizit erlaubte Reveal-Mentions |
| B24 | Spieler kennt mehr als NPC | NPC-Snapshot unverändert; does_not_know möglich |
| B25 | Richtige vollständige Anklage | Challenge solved; terminal |
| B26 | Falsche bestimmte Anklage | akzeptiert not_solved; weiter active |
| B27 | Undetermined Extra in Scope | not_solved, kein false-Rewrite |
| B28 | Wahres Extra außerhalb Scope | not_solved |
| B29 | Wahres Extra innerhalb Scope | solved wenn Required vollständig |
| B30 | Fehlendes negatives Requiredliteral | not_solved |
| B31 | Doppelclaim mit gleicher/anderer Polarität | ACTION_UNAVAILABLE, kein Logeintrag |
| B32 | Alle sechs PlayerConclusionClaim-Arten | feldweise korrekte Canonical-Übersetzung |
| B33 | eventCausedEvent falscher Kind/stale causeEvent | ACTION_UNAVAILABLE |
| B34 | Event ohne neue Infos aber gültig | trotzdem geloggt |
| B35 | Event nach solved inkl. malformed | SESSION_CLOSED; keine Portaufrufe |
| B36 | Fremde Packageidentity im State | HOST_FAILURE vor terminal |
| B37 | 33 Anklageliterale oder >16KiB | ACTION_UNAVAILABLE; unverändert |
| B38 | 513. gültiges Event | LIMIT_REACHED; unverändert |
| B39 | Prospective Save überschreitet 1MiB | LIMIT_REACHED vor Commit |
| B40 | Raw Event/Output nach Aufruf mutieren | eigener frozen State bleibt unverändert |
| C01 | Leere Historie speichern/laden | initialSession identisch |
| C02 | Vollständiger Vitrine-Witness roundtrip | Known/Discoveries/Records identisch |
| C03 | Solved-Historie roundtrip | terminal unverändert |
| C04 | State Derived-Knowledge manipuliert beim Encode | INVALID_STATE |
| C05 | State Verdict manipuliert beim Encode | INVALID_STATE |
| C06 | Save mit knowledge-Zusatzfeld | INVALID_SAVE |
| C07 | Save mit phase/snapshot-Zusatzfeld | INVALID_SAVE |
| C08 | Save root schemaVersion=2 | INVALID_SAVE |
| C09 | Unbekannter rulesetVersion | INCOMPATIBLE_PACKAGE |
| C10 | Geänderter packageHash | INCOMPATIBLE_PACKAGE |
| C11 | Nur Presentationtext neuer Packageversion | INCOMPATIBLE_PACKAGE |
| C12 | Nur NPC-Provenance neuer Packageversion | INCOMPATIBLE_PACKAGE |
| C13 | Alter Save mit archiviertem exakten Package | erfolgreich bei gleichem Ruleset |
| C14 | Geändertes Event ohne Checksumupdate | CHECKSUM_MISMATCH |
| C15 | Checksum uppercase/falsche Länge | INVALID_SAVE |
| C16 | Neuer gültiger Verlauf mit neuer Checksum | akzeptiert; keine Anti-Cheat-Garantie |
| C17 | Kürzeres gültiges Präfix neu checksummiert | akzeptiert; kein Rollbackschutz |
| C18 | Historie umgeordnet, Checksum neu | Replay entscheidet; ungültiges Präfix INVALID_HISTORY |
| C19 | Historie nach solved, Checksum neu | INVALID_HISTORY, kein Abschneiden |
| C20 | Abgewiesenes Event zwischen gültigen | INVALID_HISTORY, kein Überspringen |
| C21 | Unbekannte/stale Refs in neu checksummiertem Log | INVALID_HISTORY |
| C22 | Unsinniges accepted=true-Zusatzfeld | INVALID_HISTORY/INVALID_SAVE; nie Autorität |
| C23 | Doppelte JSON-Rootkeys | INVALID_SAVE durch Wirekanonisierung |
| C24 | Doppelte verschachtelte Keys | INVALID_SAVE |
| C25 | Whitespace vor/nach JSON | INVALID_SAVE; Codec akzeptiert seine kanonische Form |
| C26 | BOM/invalid JSON | INVALID_SAVE |
| C27 | String mit lone surrogate | INVALID_SAVE |
| C28 | NFC versus NFD | keine Normalisierung; verschiedene Bytes |
| C29 | JSON -0 versus 0 | nichtkanonisches -0 abweisen |
| C30 | Propertyorder nicht kanonisch | INVALID_SAVE; intern C ordnet Objekte |
| C31 | Events vertauschen im Checksumpräimage | Checksum verschieden |
| C32 | Literale innerhalb Event vertauschen | Verlaufbytes verschieden; semantischer Verdict kann gleich sein |
| C33 | Save exakt 1MiB und ein Byte darüber | Grenze inklusive / LIMIT_REACHED |
| C34 | Mehr als 512 Events vor Replay | LIMIT_REACHED |
| C35 | Tiefe 33 / über 100000 Nodes | LIMIT_REACHED vor rekursiven Funktionen |
| C36 | Replay-Port wirft | HOST_FAILURE; keine Teilzustandsausgabe |
| C37 | Replay ohne alte Packageversion | kein automatisches Upgrade |
| C38 | Gleiche Historie zweimal replayen | tiefe Gleichheit, keine geteilte veränderliche Stateautorität |
| C39 | 640 generierte Historien mit Präfixvergleich | incremental = replay = load, Reject unverändert |
| C40 | Checksum korrekt aber technischer Bindingfehler | HOST_FAILURE/inkompatibel, niemals not_solved |
