::gap{id=G-16 from="arc planning research into what assumes one machine, 2026-11-10"}

# The hub answers the whole local network, unauthenticated, including the machine door

**Measured on this machine, 2026-11-10, against the running hub.** Not read off the source and
reasoned about — called over the non-loopback address with `curl` and the content came back.

```
$ lsof -nP -iTCP -sTCP:LISTEN
node  93914  …  TCP *:3000 (LISTEN)        ← the hub, on every interface
$ ipconfig getifaddr en0
10.0.0.14

$ curl -X POST http://10.0.0.14:3000/systemview/api/SystemView/readPath \
    -H 'content-type: application/json' -H 'Origin: http://evil.example' \
    -d '{"__arguments":[{"path":"/etc/hosts"}]}'
{… "returnValue":{"ok":true,"path":"/etc/hosts","machine":true,"content":"## Host Database …"}}

$ curl -X POST http://10.0.0.14:3000/systemview/api/SystemView/writePath \
    -H 'content-type: application/json' \
    -d '{"__arguments":[{"path":"/tmp/sv-door-proof.txt","content":"…"}]}'
{… "returnValue":{"ok":true,"path":"/tmp/sv-door-proof.txt","machine":true}}
$ cat /tmp/sv-door-proof.txt     # it was there. removed again immediately.
```

`~/.autobot/projects.json` came back the same way, listing every project directory on the machine.

## Why it is open, in three parts that are each individually reasonable

1. **The bind takes no address.** `node_modules/systemlynx/systemlynx/ServerManager/ServerManager.js:116`
   is `httpServer.listen(port, …)` with no host argument, so Node binds `::`/`0.0.0.0`.
2. **`host` is cosmetic.** `api/index.js:225` sets `const host = "localhost"` and passes it at
   `api/index.js:3068-3072`, but SystemLynx uses that string **only to build the advertised URL**
   (`ServerManager.js:63`, `:87-91`). It never reaches `listen`. So the one line in this repo that
   looks like it binds loopback does not bind anything.
3. **CORS is `*` and nothing checks a caller.** `.../ServerManager/components/Server.js:48-57` sets
   `Access-Control-Allow-Origin: *` whenever the framework owns the express app — which it does,
   since `api/index.js:3068` passes no `customServer`. Socket.IO is `origin: "*"` at
   `ServerManager.js:69-75`. A grep of SystemLynx for `authoriz|authenticat|token|secret|signature`
   finds nothing in the request path.

## What is exposed

Every method on the hub — around ninety — to anybody who can route a packet to port 3000. The ones
that matter most:

- **`readPath` / `writePath` / `deletePath` / `listPath`** (`api/machineDoors.js:12-71`) — arbitrary
  absolute paths, `~` expanded, dotfiles included. Read is whatever the hub process can read; write
  needs only the parent directory to exist; delete unlinks a file or an empty directory.
- **`readFile` / `writeFile` / `deleteFile`** and the git verbs, over every project in
  `~/.autobot/projects.json`.
- **The terminal verbs** (`api/index.js:1960-2040`) — typing into detached `screen` sessions. These
  are the one place with a real gate (`api/terminalGrants.js:23`, "ABSENCE IS DENIAL"), and that gate
  is per-session, so it narrows this without closing it.

**The blast radius is the network he is on**, which on a laptop means coffee shops, hotels, and any
device already on his home wifi. Nothing about this requires a design decision to become a problem;
it is the current state.

## What this is NOT

It is not the cross-machine *address* bug (`serviceUrl` advertising `localhost`, so a remote client
dials back at itself). That one is separate, lives in SystemLynx, and is filed where it belongs.
These two are each other's mirror image and that is exactly why neither was noticed: **the hub is
reachable from the network but tells every client it is not, so nothing ever accidentally connected
from another machine and nobody found out it could.**

## What resolves it — one of these, on the record

1. **Bind loopback and mean it.** Pass the address through to `listen` in SystemLynx so `host`
   stops being cosmetic, and the hub becomes genuinely local. Smallest change, closes it
   completely, and costs nothing today because nothing legitimately calls the hub from off-machine.
   **This is the one I would do now**, independent of any arc.
2. **Keep the wildcard bind and gate every method on identity.** This is the arc's work — see
   `meetings/2026-11-10-the-platform-connects.md` §6 — and it must not be the thing that closes
   *this*, because the arc is weeks and this is open now.
3. **Both, in that order.** Loopback today; the gate when a second node is a real thing, at which
   point the bind widens deliberately with authentication already standing.

The reason (1) is not merely a stopgap: a node that is reachable *before* it can say who is calling
is the wrong order to build this in. Closing it now means the arc widens the door on purpose, with
the lock already fitted.
