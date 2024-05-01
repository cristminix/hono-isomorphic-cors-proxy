// 'use strict'
// const url = require('url')
// const {send} = require('micro')
// const microCors = require('micro-cors')
// const fetch = require('node-fetch')
// import url from url
import allow from "./allow-request.js"

const filter = (predicate, middleware) => {
  console.log(predicate, middleware)
  async function corsProxyMiddleware(req, res, next) {
    console.log("AAA")
    if (predicate(req, res)) {
      console.log("HERE")
      // middleware(req, res, next)
    } else {
      console.log("HERE B")

      await next()
    }
  }
  return corsProxyMiddleware
}

const compose = (...handlers) => {
  const composeTwo = (handler1, handler2) => {
    async function composed(req, res, next) {
      handler1(req, res, async (err) => {
        if (err) {
          return await next(err)
        } else {
          return handler2(req, res, next)
        }
      })
    }
    return composed
  }
  let result = handlers.pop()
  while (handlers.length) {
    result = composeTwo(handlers.pop(), result)
  }
  console.log(handlers)
  console.log(result, 39)
  return result
}

function noop(_req, _res, next) {
  next()
}

export default function ({
  origin,
  insecure_origins = [],
  authorization = noop,
} = {}) {
  function predicate(req) {
    let u = new URL(req.url)
    // Not a git request, skip
    return allow(req, u)
  }
  async function sendCorsOK(req, res, next) {
    console.log("hello")
    // Handle CORS preflight request
    if (req.method === "OPTIONS") {
      return send(res, 200, "")
    } else {
      await next()
    }
  }
  function middleware(req, res, next) {
    let u = new URL(req.url)

    let headers = {}
    for (let h of allowHeaders) {
      if (req.headers[h]) {
        headers[h] = req.headers[h]
      }
    }

    // GitHub uses user-agent sniffing for git/* and changes its behavior which is frustrating
    if (!headers["user-agent"] || !headers["user-agent"].startsWith("git/")) {
      headers["user-agent"] = "git/@isomorphic-git/cors-proxy"
    }

    let p = u.path
    let parts = p.match(/\/([^\/]*)\/(.*)/)
    let pathdomain = parts[1]
    let remainingpath = parts[2]
    let protocol = insecure_origins.includes(pathdomain) ? "http" : "https"

    fetch(`${protocol}://${pathdomain}/${remainingpath}`, {
      method: req.method,
      redirect: "manual",
      headers,
      body: req.method !== "GET" && req.method !== "HEAD" ? req : undefined,
    })
      .then((f) => {
        if (f.headers.has("location")) {
          // Modify the location so the client continues to use the proxy
          let newUrl = f.headers.get("location").replace(/^https?:\//, "")
          f.headers.set("location", newUrl)
        }
        res.statusCode = f.status
        for (let h of exposeHeaders) {
          if (h === "content-length") continue
          if (f.headers.has(h)) {
            res.setHeader(h, f.headers.get(h))
          }
        }
        if (f.redirected) {
          res.setHeader("x-redirected-url", f.url)
        }
        f.body.pipe(res)
      })
      .catch((e) => {
        console.error(e)
        next()
      })
  }
  return filter(predicate, compose([sendCorsOK, middleware]))
}
