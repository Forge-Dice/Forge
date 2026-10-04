---json
{
  "forgeContractFormat": 2,
  "taskId": "MYST-0001",
  "title": "PlayerRef V1: opaque package-bound entity references",
  "contractVersion": 1,
  "specifiedAgainst": "3d7545d843883418348004e68717399a64da7a7d",
  "supersedes": null,
  "dependencies": [
    {
      "taskId": "TASK-0001",
      "acceptedCommit": "3d7545d843883418348004e68717399a64da7a7d",
      "provenance": "legacy"
    }
  ],
  "reads": [
    "src/domain/case-truth.identity.ts",
    "src/domain/case-truth.ts",
    "tests/case-truth.fixture.ts"
  ],
  "scope": {
    "create": [
      "src/domain/player-ref.ts",
      "tests/player-ref.security.test.ts",
      "tests/player-ref.test.ts",
      "tests/player-ref.typecheck.ts"
    ],
    "modify": []
  },
  "requiredChecks": [
    {
      "name": "typecheck",
      "command": "npm run typecheck"
    },
    {
      "name": "test",
      "command": "npm test"
    }
  ],
  "mutants": [
    {
      "id": "m1",
      "file": "src/domain/player-ref.ts",
      "before": "[PLAYER_REF_PROFILE, refSalt, caseId, truthHash, kind, id].join(\"\\n\")",
      "after": "[PLAYER_REF_PROFILE, refSalt, caseId, truthHash, id].join(\"\\n\")",
      "tests": [
        "tests/player-ref.test.ts"
      ]
    },
    {
      "id": "m2",
      "file": "src/domain/player-ref.ts",
      "before": "digest(preimage).subarray(0, 10)",
      "after": "digest(preimage).subarray(0, 8)",
      "tests": [
        "tests/player-ref.test.ts"
      ]
    },
    {
      "id": "m3",
      "file": "src/domain/player-ref.ts",
      "before": "if (collisions.length > 0)",
      "after": "if (collisions.length < 0)",
      "tests": [
        "tests/player-ref.test.ts"
      ]
    },
    {
      "id": "m4",
      "file": "src/domain/player-ref.ts",
      "before": "entry.kind !== expectedKind",
      "after": "false",
      "tests": [
        "tests/player-ref.security.test.ts"
      ]
    },
    {
      "id": "m5",
      "file": "src/domain/player-ref.ts",
      "before": "/^[0-9a-f]{32}$/",
      "after": "/^[0-9a-f]{1,32}$/",
      "tests": [
        "tests/player-ref.test.ts"
      ]
    },
    {
      "id": "m6",
      "file": "src/domain/player-ref.ts",
      "before": "const ZERO_SALT = \"0\".repeat(32);",
      "after": "const ZERO_SALT = \"0\".repeat(31);",
      "tests": [
        "tests/player-ref.test.ts"
      ]
    },
    {
      "id": "m7",
      "file": "src/domain/player-ref.ts",
      "before": "\"0123456789abcdefghjkmnpqrstvwxyz\"",
      "after": "\"abcdefghijklmnopqrstuvwxyz234567\"",
      "tests": [
        "tests/player-ref.test.ts"
      ]
    },
    {
      "id": "m8",
      "file": "src/domain/player-ref.ts",
      "before": ".sort(byRef)",
      "after": "",
      "tests": [
        "tests/player-ref.test.ts"
      ]
    }
  ],
  "limits": {
    "maxProductionLines": 220,
    "maxChangedFiles": 4
  },
  "findings": []
}
---
# MYST-0001 v1: PlayerRef V1: opaque package-bound entity references

## Goal

Spielerseitige Referenzen auf Entitäten eines Falls dürfen keine kanonischen Domain-IDs (`person:ben`, `item:letter-opener`) sein, weil Slugs Spoiler tragen können und weil eine ratbare ID ein Existenz-Orakel ist. Dieser Task liefert ein reines, deterministisches Modul, das jeder Entität der Arten `person`, `location`, `item`, `event`, `evidence` einer geparsten `CaseTruth` eine opake, an einen geheimen 128-Bit-Salt und an die exakte Truth gebundene Referenz (`PlayerRef`) zuordnet und eingehende Spielerreferenzen ohne Orakel auflöst.

Das Modul ist eine Bibliothek. Es kennt kein Spielerwissen, keine Session, kein CasePackage und keine NPC-Projektion. Auflösen heißt nur "diese Referenz bezeichnet diese Entität"; es heißt nie "der Spieler darf diese Entität sehen oder benutzen".

## Basis und gelesene Fakten

Alle Fakten wurden an `specifiedAgainst` (`3d7545d843883418348004e68717399a64da7a7d`) im Code geprüft.

| Fakt | Ort |
|---|---|
| ID-Schemas `PersonIdSchema`, `LocationIdSchema`, `ItemIdSchema`, `EventIdSchema`, `EvidenceIdSchema`, `CaseIdSchema`; Form `^<prefix>:[a-z0-9][a-z0-9_-]{0,63}$`, also reines ASCII ohne Zeilenumbruch | `src/domain/case-truth.ts` |
| Typen `PersonId`, `LocationId`, `ItemId`, `EventId`, `EvidenceId`, `CaseId`, `CaseTruth`, `DeepReadonly` sind exportiert | `src/domain/case-truth.ts` |
| Alle IDs einer `CaseTruth` sind über alle Collections hinweg eindeutig (eine gemeinsame `known`-Menge in `checkReferenceIntegrity`) | `src/domain/case-truth.ts` |
| `CaseTruth` ist tief eingefroren und nur über `parseCaseTruth` erhältlich | `src/domain/case-truth.ts` |
| `hashCaseTruth(truth)` liefert 64 Hex-Zeichen (klein); `node:crypto` `createHash` ist im Domain-Code bereits verwendet | `src/domain/case-truth.identity.ts` |
| `goldenCase()` ergibt `caseId` `case:golden` und `hashCaseTruth` = `bd95eb9a8569f4f3f62eab50aac94e75cd601b54e3432776cc6663a204647501` (`GOLDEN_SHA256`) | `tests/case-truth.fixture.ts` |
| `fullCase()` ergibt `caseId` `case:letter-opener`, `hashCaseTruth` = `f8794eba02ff4cb846158a9d5d145ade93e24fd109d88f7a4b5244f175453a73`, 3 Personen, 2 Orte, 2 Items, 3 Events, 4 Evidence | `tests/case-truth.fixture.ts` (am Basis-Commit ausgeführt) |

Neu ist nur, was §Design definiert. Keine bestehende Datei wird geändert. Keine neue Dependency.

## Design

### D1. Arten

`PLAYER_REF_KINDS = ["person", "location", "item", "event", "evidence"] as const`, in genau dieser Reihenfolge. `proposition`, `conclusion`, `secret`, `red-herring`, `motive`, `relationship` und `case` erhalten nie eine PlayerRef; der Typ `PlayerRefKind` lässt sie nicht zu, und der Index enthält sie nie.

### D2. Salt

`refSalt` ist ein String aus genau 32 Kleinbuchstaben-Hex-Zeichen (128 Bit). Der String `"0".repeat(32)` ist verboten. Großbuchstaben, Präfixe (`0x`), Leerzeichen und andere Längen sind ungültig; es gibt keine Normalisierung. Das Modul erzeugt nie selbst einen Salt (kein Zufall im Domain-Code); der Salt ist eine Autoreneingabe, die später im CasePackage liegt.

### D3. Ableitung

Für eine Entität `(kind, id)` einer Truth mit `caseId` und `truthHash = hashCaseTruth(truth)`:

1. `preimage` = Verkettung von genau sechs Feldern mit `"\n"` als Trenner und ohne abschließenden Zeilenumbruch: `PLAYER_REF_PROFILE` (`"forge-mystery-playerref-v1"`), `refSalt`, `caseId`, `truthHash`, `kind`, `id`. Alle Felder sind ASCII und enthalten kein `"\n"`.
2. `digest` = SHA-256 über die UTF-8-Bytes von `preimage` (32 Bytes).
3. Die ersten 10 Bytes (80 Bit) werden als vorzeichenlose Big-Endian-Zahl gelesen und in 16 Gruppen zu je 5 Bit zerlegt, höchstwertige Gruppe zuerst.
4. Jede Gruppe `g` wird auf `ALPHABET[g]` abgebildet mit `ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz"` (Crockford-Base32, klein, ohne `i`, `l`, `o`, `u`).
5. `PlayerRef` = `"pr1_"` gefolgt von diesen 16 Zeichen. Länge immer 20, nur ASCII, Form `^pr1_[0-9a-hjkmnp-tv-z]{16}$`.

Die Art ist Teil der Ableitung, erscheint aber nicht im Referenzstring (opak). Es gibt keine dynamische Verlängerung und keine zweite Länge.

### D4. Index und Kollisionen

`buildPlayerRefIndex(truth, refSalt, digest?)` leitet für jede Entität der fünf Arten eine Referenz ab. Erzeugen zwei verschiedene Entitäten dieselbe Referenz, scheitert der Aufbau mit `REF_COLLISION`; es gibt keine Verlängerung, kein Ausweichen und keinen Teilindex. Bei Erfolg enthält der Index alle Einträge, nach `ref` aufsteigend nach UTF-16-Codeeinheiten sortiert (kein `localeCompare`), tief eingefroren und nominal gebrandet. Der Index trägt `caseId` und `truthHash`, aber **nie** den Salt.

Der Parameter `digest` ist ein Port mit Default `nodePlayerRefDigest` (SHA-256 über `node:crypto`). Er existiert ausschließlich, damit Tests den Kollisionspfad erreichen; Ports sind vertrauenswürdiger Hostcode und werden nicht validiert (gleiches Vertrauensmodell wie der Sha256-Port in `src/forge/contract-document.ts`).

### D5. Auflösung

`resolvePlayerRef(index, input, expectedKind?)` nimmt eine beliebige Spielereingabe (`unknown`). Sie liefert `{ success: true, kind, id }` genau dann, wenn `input` ein String ist, der exakt (ohne Normalisierung, ohne Groß-/Kleinschreibungsfaltung) einem Index-Eintrag gleicht und, falls `expectedKind` gesetzt ist, dessen Art gleich `expectedKind` ist. In **jedem** anderen Fall (kein String, falsches Format, unbekannt, aus anderem Salt, aus anderer Truth, falsche Art) liefert sie dasselbe eingefrorene Objekt `{ success: false, code: "REF_UNRESOLVED" }`, ohne Echo der Eingabe und ohne weitere Felder.

`playerRefFor(index, kind, id)` liefert die Referenz einer Entität des Index oder `null`. Es ist die einzige vorgesehene Quelle von PlayerRefs für spätere Projektionsschichten.

### D6. Informationsgrenzen

- Spielerseitige Fehler (`REF_UNRESOLVED`) enthalten nie eine kanonische ID, eine Art, einen Salt oder die Eingabe.
- Aufbaufehler (`REF_SALT_INVALID`, `REF_COLLISION`) sind autorenseitig. `REF_COLLISION` nennt die kollidierenden Entitäten; dieses Ergebnis darf nie an einen Spieler gelangen (spätere Abbildung durch das CasePackage auf einen Paketfehler).
- Auflösung ist keine Autorisierung: `resolvePlayerRef` löst jede Entität des Index auf, gleichgültig ob ein Spieler sie kennt. Wissens- und Berechtigungsprüfungen gehören der späteren Session-Schicht.
- Das Modul enthält keine `WeakMap`, kein `WeakSet`, kein `WeakRef`, keine `Symbol`-Felder, keinen modulweiten veränderlichen Zustand, kein `Math.random`, keine Systemzeit und kein `localeCompare`.

### D7. Öffentliche API (vollständig)

```ts
export const PLAYER_REF_PROFILE: "forge-mystery-playerref-v1";
export const PLAYER_REF_KINDS: readonly ["person", "location", "item", "event", "evidence"];
export type PlayerRefKind = (typeof PLAYER_REF_KINDS)[number];

export const RefSaltSchema;   // zod, brand "RefSalt"
export type RefSalt;
export const PlayerRefSchema; // zod, brand "PlayerRef", Form aus D3
export type PlayerRef;

export type PlayerRefDigest = (preimage: string) => Uint8Array;
export const nodePlayerRefDigest: PlayerRefDigest;

export function derivePlayerRef(
  input: { refSalt: RefSalt; caseId: CaseId; truthHash: string; kind: PlayerRefKind; id: string },
  digest?: PlayerRefDigest,
): PlayerRef;

export type ResolvedEntity =
  | { readonly kind: "person"; readonly id: PersonId }
  | { readonly kind: "location"; readonly id: LocationId }
  | { readonly kind: "item"; readonly id: ItemId }
  | { readonly kind: "event"; readonly id: EventId }
  | { readonly kind: "evidence"; readonly id: EvidenceId };

export type PlayerRefEntry = ResolvedEntity & { readonly ref: PlayerRef };
export type PlayerRefIndex; // gebrandet, tief eingefroren:
// { schemaVersion: 1; profile: "forge-mystery-playerref-v1"; caseId: CaseId; truthHash: string; entries: readonly PlayerRefEntry[] }

export type PlayerRefCollision = {
  readonly ref: PlayerRef;
  readonly first: ResolvedEntity;
  readonly second: ResolvedEntity;
};
export type PlayerRefBuildResult =
  | { readonly success: true; readonly index: PlayerRefIndex }
  | { readonly success: false; readonly code: "REF_SALT_INVALID" }
  | { readonly success: false; readonly code: "REF_COLLISION"; readonly collisions: readonly PlayerRefCollision[] };

export function buildPlayerRefIndex(truth: CaseTruth, refSalt: unknown, digest?: PlayerRefDigest): PlayerRefBuildResult;
export function playerRefFor(index: PlayerRefIndex, kind: PlayerRefKind, id: string): PlayerRef | null;

export type PlayerRefResolution =
  | ({ readonly success: true } & ResolvedEntity)
  | { readonly success: false; readonly code: "REF_UNRESOLVED" };
export function resolvePlayerRef(index: PlayerRefIndex, input: unknown, expectedKind?: PlayerRefKind): PlayerRefResolution;
```

Weitere Exporte sind nicht erlaubt. Ergebnisobjekte werden in fester Schlüsselreihenfolge neu konstruiert und tief eingefroren; kein Ergebnis teilt ein Objekt mit `truth`. `collisions` ist nach `ref`, dann nach `(PLAYER_REF_KINDS`-Reihenfolge, `id`) sortiert; innerhalb einer Kollision ist `first` die kleinere Entität in dieser Ordnung.

### D8. Mutationsanker (Pflicht)

`src/domain/player-ref.ts` enthält jeden der folgenden Texte **genau einmal**, wörtlich:

| Anker | Zweck |
|---|---|
| `[PLAYER_REF_PROFILE, refSalt, caseId, truthHash, kind, id].join("\n")` | Preimage D3.1 |
| `digest(preimage).subarray(0, 10)` | 80-Bit-Kürzung D3.3 |
| `"0123456789abcdefghjkmnpqrstvwxyz"` | Alphabet D3.4 |
| `/^[0-9a-f]{32}$/` | Salt-Form D2 |
| `const ZERO_SALT = "0".repeat(32);` | Null-Salt-Verbot D2 |
| `if (collisions.length > 0)` | Kollisionsabbruch D4 |
| `.sort(byRef)` | Indexordnung D4 |
| `entry.kind !== expectedKind` | Artprüfung D5 |

## Acceptance Criteria

- AC-01 Exporte von `src/domain/player-ref.ts` sind genau die aus D7.
- AC-02 Testvektoren V-01 bis V-04 (§Test Matrix) werden bytegleich reproduziert, sowohl über `derivePlayerRef` als auch über `buildPlayerRefIndex(parseCaseTruth(goldenCase()), SALT_A)`.
- AC-03 `buildPlayerRefIndex(parseCaseTruth(fullCase()), SALT_A)` liefert genau die 14 Einträge aus V-10 in genau dieser Reihenfolge.
- AC-04 Jede erzeugte Referenz erfüllt `^pr1_[0-9a-hjkmnp-tv-z]{16}$`, hat Länge 20 und besteht nur aus ASCII.
- AC-05 Der Index enthält nie Einträge für Propositionen, Secrets, Red Herrings, Motive, Relationships oder die Case-ID (Test über `fullCase()`, das alle diese Collections befüllt).
- AC-06 Andere `refSalt` (`SALT_B`) ergibt für jede Entität eine andere Referenz als `SALT_A`; V-05 wird reproduziert.
- AC-07 Eine Truth mit anderer Revision (sonst gleich) ergibt andere Referenzen (Bindung an `truthHash`).
- AC-08 Die Art ist Teil der Ableitung: `derivePlayerRef` mit gleichem `id`, aber anderem `kind` liefert eine andere Referenz.
- AC-09 Ungültige Salts liefern `{ success: false, code: "REF_SALT_INVALID" }`: Länge 31 und 33, Großbuchstaben, `0x`-Präfix, Leerzeichen, Nicht-Hex, `"0".repeat(32)`, Nicht-String (`undefined`, Zahl, Objekt).
- AC-10 Mit einem Test-Digest, der für zwei bestimmte Preimages dieselben ersten 10 Bytes liefert, liefert der Aufbau `REF_COLLISION` mit genau einer Kollision, korrekt geordnet; mit einem konstanten Test-Digest liefert er alle Kollisionen deterministisch sortiert. Es entsteht nie ein Teilindex.
- AC-11 `resolvePlayerRef` löst jeden Index-Eintrag zur richtigen `(kind, id)` auf, mit und ohne passendes `expectedKind`.
- AC-12 `resolvePlayerRef` liefert für alle folgenden Eingaben ein Ergebnis, das tief gleich `{ success: false, code: "REF_UNRESOLVED" }` ist, genau diese zwei Schlüssel hat und eingefroren ist: `undefined`, `null`, Zahl, Objekt, `""`, Referenz in Großbuchstaben, Referenz mit führendem oder folgendem Leerzeichen, Referenz mit `i`/`l`/`o`/`u`, 15 und 17 Zeichen nach `pr1_`, gültige Form aber unbekannt, Referenz desselben Falls unter `SALT_B`, Referenz einer anderen Truth, bekannte Referenz mit falschem `expectedKind`, kanonische ID (`"person:anna"`).
- AC-13 `JSON.stringify` keines Fehlerergebnisses von `resolvePlayerRef` enthält `:`-haltige Domain-IDs, Artnamen, den Salt oder die Eingabe.
- AC-14 `playerRefFor` liefert für jeden Eintrag dessen Referenz und für unbekannte `(kind, id)` sowie für Art-ID-Fehlpaarungen `null`.
- AC-15 Index, Einträge, Kollisionen und Auflösungsergebnisse sind tief eingefroren; Mutationsversuche werfen im Strict Mode; `truth` bleibt unverändert und teilt kein Objekt mit einem Ergebnis.
- AC-16 Der Index enthält den Salt in keiner Form (`JSON.stringify(index)` enthält `SALT_A` nicht).
- AC-17 Determinismus: zwei Aufbauten mit gleichen Eingaben sind `JSON.stringify`-gleich; die Reihenfolge der Collections in der Authoring-Eingabe beeinflusst den Index nicht (Permutationstest).
- AC-18 Der Quelltext von `src/domain/player-ref.ts` enthält keines der Tokens `WeakMap`, `WeakSet`, `WeakRef`, `Symbol(`, `Math.random`, `Date.now`, `new Date`, `localeCompare` (Test liest die Datei).
- AC-19 Typprüfung (`tests/player-ref.typecheck.ts`, `@ts-expect-error`): ein Objektliteral ist kein `PlayerRefIndex`; ein einfacher String ist keine `PlayerRef` und kein `RefSalt`; `PlayerRefKind` akzeptiert nicht `"proposition"` und nicht `"conclusion"`; Index und Ergebnisse sind `readonly`.
- AC-20 Jeder Anker aus D8 kommt genau einmal vor; alle acht Mutanten werden getötet.
- AC-21 `npm run typecheck` und `npm test` sind grün; alle Bestandstests bleiben unverändert grün.

## Test Matrix

Konstanten: `SALT_A = "000102030405060708090a0b0c0d0e0f"`, `SALT_B = "ffeeddccbbaa99887766554433221100"`.

Vektoren mit `caseId = "case:golden"`, `truthHash = "bd95eb9a8569f4f3f62eab50aac94e75cd601b54e3432776cc6663a204647501"`, `refSalt = SALT_A`:

| ID | kind | id | PlayerRef | SHA-256 des Preimage |
|---|---|---|---|---|
| V-01 | person | person:a | `pr1_xfs3rzypnyradx49` | `ebf23c7fd6afb0a6f4898f08dc1b26015990d4c0ca0d8d06e3ef1578f99d1d95` |
| V-02 | person | person:b | `pr1_zmkgz9c35yhk1qa3` | `fd270fa5832fa330dd43413206e9cf1f6d3b2456fcb432e7eebd29722cbcd797` |
| V-03 | location | location:hall | `pr1_znh7e2dfbmaffz8n` | `fd627709af5d14f7fd1524f25e8ffa2c638ef53232f12fbceab018cda616de8a` |
| V-04 | event | event:e1 | `pr1_yyqw0dn6dan7mbdt` | `f7afc036a66aaa7a2dba89925daa971b65c347e3734c9ed12906dc1a88ec2b7a` |
| V-05 | person | person:a, aber `refSalt = SALT_B` | `pr1_44rh5ek8sxdz4w97` | |

Unabhängige Reproduktion von V-01 ohne Projektcode: `printf 'forge-mystery-playerref-v1\n000102030405060708090a0b0c0d0e0f\ncase:golden\nbd95eb9a8569f4f3f62eab50aac94e75cd601b54e3432776cc6663a204647501\nperson\nperson:a' | sha256sum` ergibt den Hash in V-01; dessen erste 20 Hex-Zeichen `ebf23c7fd6afb0a6f489` ergeben nach D3.3 und D3.4 `xfs3rzypnyradx49`.

V-10, Index für `fullCase()` (`caseId = "case:letter-opener"`, `truthHash = "f8794eba02ff4cb846158a9d5d145ade93e24fd109d88f7a4b5244f175453a73"`, `SALT_A`), in Indexreihenfolge:

| # | ref | kind | id |
|---|---|---|---|
| 1 | `pr1_4f7xab53w32bm1nq` | evidence | evidence:muddy-path |
| 2 | `pr1_5s8wthkphwmbqdc6` | item | item:gloves |
| 3 | `pr1_6285tzxc83e3g5q1` | event | event:argument |
| 4 | `pr1_6yp173ecv3kyxw7a` | person | person:clara |
| 5 | `pr1_8ygr2bxhpn23v044` | location | location:garden |
| 6 | `pr1_91c38h84td51armq` | person | person:ben |
| 7 | `pr1_a03gmjhxm43jy18s` | event | event:murder |
| 8 | `pr1_an69m26v8wh36rry` | person | person:anna |
| 9 | `pr1_e74ex610g3y06nkv` | item | item:letter-opener |
| 10 | `pr1_ev3pwyaqzgwkdj6b` | location | location:library |
| 11 | `pr1_exgtx0h021znk18z` | event | event:walk |
| 12 | `pr1_ppefvgdapyzmbdwy` | evidence | evidence:fingerprint |
| 13 | `pr1_ptkpjfzwyt1j4hxq` | evidence | evidence:gloves-dirty |
| 14 | `pr1_zmsb75vykvcrjr04` | evidence | evidence:anna-statement |

Dateien und Zuordnung:

| Datei | Inhalt |
|---|---|
| `tests/player-ref.test.ts` | AC-02 bis AC-11, AC-14 bis AC-17, AC-20 |
| `tests/player-ref.security.test.ts` | AC-12, AC-13, AC-18 und die Leak-Prüfungen aus AC-05 und AC-16 |
| `tests/player-ref.typecheck.ts` | AC-19 |

Fixtures werden ausschließlich aus `tests/case-truth.fixture.ts` importiert (`goldenCase`, `fullCase`); diese Datei wird nicht geändert.

## Mutants

Die Frontmatter-Mutanten m1 bis m8 werden vom Code-Reviewer am verifizierten Head angewendet. Erwartung je Mutant: mindestens ein genannter Test schlägt fehl.

| ID | Wirkung | Getötet durch |
|---|---|---|
| m1 | Art fehlt in der Ableitung | Vektoren V-01 bis V-04, AC-08 |
| m2 | 64 statt 80 Bit | Vektoren, Formregel |
| m3 | Kollision führt nicht zum Abbruch | AC-10 |
| m4 | falsche Art wird aufgelöst | AC-12 (falsches `expectedKind`) |
| m5 | kürzere Salts werden akzeptiert | AC-09 (Länge 31) |
| m6 | Null-Salt wird akzeptiert | AC-09 (`"0".repeat(32)`) |
| m7 | RFC-4648-Alphabet statt Crockford | Vektoren, Formregel |
| m8 | Index unsortiert | AC-03 (V-10-Reihenfolge) |

## Non-Goals

- Keine Brücke von NPC-`VisibleRef` zu PlayerRef, kein Translator, keine Änderung an `src/domain/npc-knowledge*.ts`.
- Kein CasePackage, keine Salt-Speicherung, keine Salt-Erzeugung, kein Briefing, keine Session, kein Spielerwissen, keine Autorisierung.
- Keine PlayerRefs für Propositionen oder Conclusions; keine Anklage-, Evidence- oder Dialog-Logik.
- Keine Serialisierung oder Persistenz des Index (er wird immer aus Truth und Salt neu gebaut).
- Keine Normalisierung von Spielereingaben (keine Crockford-Faltung `i`/`l` zu `1`, `o` zu `0`, keine Großschreibung).
- Keine variable Referenzlänge, keine Prüfsumme im Referenzstring.
- Keine Änderung an bestehenden Dateien, `package.json`, Lockfile, `tsconfig.json`; keine neue Dependency.

<!-- END OF CONTRACT MYST-0001 v1 -->
