# Security policy

## Reporting a vulnerability

Please report vulnerabilities **privately**, never in a public issue:

- **Preferred:** [open a GitHub security advisory](https://github.com/thrishankkuntimaddi/Oruinwan/security/advisories/new)
- **Or e-mail** [admin@poelys.com](mailto:admin@poelys.com?subject=Oruinwan%20security%20report) with "security" in the subject

Include what you found, how to reproduce it, which version or server (hosted
oruinwan.poelys.com or self-hosted), and the impact you expect.

What to expect:

| | |
|---|---|
| Acknowledgement | within 3 business days |
| First assessment | within 7 days |
| Fix for critical / high issues | as fast as we can, normally within 30 days |
| Credit | in the release notes, if you want it |

Please give us a reasonable time to fix an issue before you disclose it, and don't access other
people's data or degrade the hosted service while testing. Use your own accounts and workspaces.

## Supported versions

Only the latest release gets security fixes. The hosted server and the apps update themselves.
Self-hosters should update to the newest release.

## What the encryption does and does not protect

Message text is encrypted on the sender's device (AES-256-GCM, a key per conversation, wrapped for
each member with their RSA-OAEP key) and is stored only as ciphertext. The server also keeps an
escrowed copy of every conversation key, sealed with the server master key (`SERVER_KEK`). That
copy lets AI agents answer in encrypted conversations and lets people keep access after a password
reset.

This means:

- A leaked database alone does not expose message text.
- Someone with **both** the database and `SERVER_KEK` (the operator, or an attacker who has both)
  can decrypt messages. This is not end-to-end or zero-knowledge encryption. Self-host to hold that
  key yourself.
- Attachments, notes, knowledge pages and meeting transcripts are not encrypted on the device. They
  are protected by access checks and encrypted in transit.

Reports showing that the operator can read messages with `SERVER_KEK` are expected behaviour.
Reports showing that anyone **else** can are exactly what we want to hear about.
