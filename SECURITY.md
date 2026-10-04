# Security Policy

Please report potential vulnerabilities privately to the repository owner rather than opening a public issue. Include a minimal reproduction, the affected commit, and the impact.

`Address.html` makes no network requests and loads no external resources by design; any change that introduces one is in scope. Non-finite or wrong-length frames are rejected by design (fail closed); a case where such input is silently scored is in scope.
