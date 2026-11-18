# Security scope

Xoditor filters imported HTML in the browser, but is not a server security boundary.
Apply server-side sanitization before storing or rendering untrusted documents.
Application code owns permissions, storage, uploaded-file validation and CSP.

The import policy strips executable elements, event handlers, dangerous URL
schemes, active SVG/MathML, forms, source-document attributes and navigation
side channels. Raster data-image URLs are supported; SVG data images are not.
Responsive image `srcset` attributes are currently removed on import.
New-tab links receive `noopener noreferrer`.

Template CSS is retained for document fidelity. It can change layout and load
remote resources. Do not render untrusted template CSS in a privileged application
page; use an isolated preview and an appropriate content security policy.

The browser suite includes adversarial HTML regression cases. Passing those
cases is not an independent security audit or a claim that all attack classes
have been eliminated. Report suspected vulnerabilities privately to the project
maintainer through https://rameshmaharjan.info.np before public disclosure.
