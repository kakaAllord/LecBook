# Report fonts

Every PDF report is set in **Trebuchet MS**. It is a Microsoft font, so it is
not bundled by default. Put the two files here and commit them:

| File           | Where to get it                                   |
| -------------- | ------------------------------------------------- |
| `trebuc.ttf`   | `C:\Windows\Fonts\trebuc.ttf` on a licensed Windows PC   |
| `trebucbd.ttf` | `C:\Windows\Fonts\trebucbd.ttf` on a licensed Windows PC |

The names must match exactly (lower case). Until both are here, reports are
printed in Helvetica instead. Nothing fails; they just use a different typeface.
`src/lib/pdf.ts` reads them, and `next.config.ts` ships them with the server build.
