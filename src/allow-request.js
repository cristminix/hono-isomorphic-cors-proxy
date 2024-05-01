function isPreflightInfoRefs(req, u, requestHeaders) {
  return (
    req.method === "OPTIONS" &&
    u.pathname.endsWith("/info/refs") &&
    (u.query.service === "git-upload-pack" ||
      u.query.service === "git-receive-pack")
  )
}

function isInfoRefs(req, u, requestHeaders) {
  return (
    req.method === "GET" &&
    u.pathname.endsWith("/info/refs") &&
    (u.query.service === "git-upload-pack" ||
      u.query.service === "git-receive-pack")
  )
}

function isPreflightPull(req, u, requestHeaders) {
  console.log(requestHeaders, `LINE 20`)
  return (
    req.method === "OPTIONS" &&
    requestHeaders["access-control-request-headers"].includes("content-type") &&
    u.pathname.endsWith("git-upload-pack")
  )
}

function isPull(req, u, requestHeaders) {
  return (
    req.method === "POST" &&
    requestHeaders["content-type"] ===
      "application/x-git-upload-pack-request" &&
    u.pathname.endsWith("git-upload-pack")
  )
}

function isPreflightPush(req, u, requestHeaders) {
  return (
    req.method === "OPTIONS" &&
    requestHeaders["access-control-request-headers"].includes("content-type") &&
    u.pathname.endsWith("git-receive-pack")
  )
}

function isPush(req, u, requestHeaders) {
  return (
    req.method === "POST" &&
    requestHeaders["content-type"] ===
      "application/x-git-receive-pack-request" &&
    u.pathname.endsWith("git-receive-pack")
  )
}

export default function allow(req, u, requestHeaders) {
  // console.log(req)
  // requestHeaders = requestHeaders
  return (
    isPreflightInfoRefs(req, u, requestHeaders) ||
    isInfoRefs(req, u, requestHeaders) ||
    isPreflightPull(req, u, requestHeaders) ||
    isPull(req, u, requestHeaders) ||
    isPreflightPush(req, u, requestHeaders) ||
    isPush(req, u, requestHeaders)
  )
}
