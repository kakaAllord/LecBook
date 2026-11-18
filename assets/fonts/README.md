# Report fonts

Every PDF report is set in **Trebuchet MS**, read from the two files here:

| File           | Face                     |
| -------------- | ------------------------ |
| `trebuc.ttf`   | Trebuchet MS Regular     |
| `trebucbd.ttf` | Trebuchet MS Bold        |

Both are Microsoft's 2016 release (version 5.15), copied from a licensed Windows
font folder. Trebuchet MS is a Microsoft font: keep this repository private, and
if it is ever made public, remove these files and supply them at deploy time instead.

The names must match exactly (lower case). If either file is missing, reports are
printed in Helvetica instead. Nothing fails; they just use a different typeface.
`src/lib/pdf.ts` reads them, and `next.config.ts` ships them with the server build.
