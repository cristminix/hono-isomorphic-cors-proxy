import { Hono } from "hono"
import { cors } from "hono/cors"
import { stream } from "hono/streaming"
import allow from "./allow-request"
const allowHeaders = [
  "accept-encoding",
  "accept-language",
  "accept",
  "access-control-allow-origin",
  "authorization",
  "cache-control",
  "connection",
  "content-length",
  "content-type",
  "dnt",
  "git-protocol",
  "pragma",
  "range",
  "referer",
  "user-agent",
  "x-authorization",
  "x-http-method-override",
  "x-requested-with",
]
const exposeHeaders = [
  "accept-ranges",
  "age",
  "cache-control",
  "content-length",
  "content-language",
  "content-type",
  "date",
  "etag",
  "expires",
  "last-modified",
  "location",
  "pragma",
  "server",
  "transfer-encoding",
  "vary",
  "x-github-request-id",
  "x-redirected-url",
]
const allowMethods = ["POST", "GET", "OPTIONS"]
const app = new Hono()

const View = () => {
  return (
    <html>
      <title>Hono isomorphic-cors-proxy</title>
      <h1>cristminix/isomorphic-cors-proxy</h1>
      <p>
        This is the server software that runs on{" "}
        <a href="https://cors.isomorphic-git.org">
          https://cors.isomorphic-git.org
        </a>
        &ndash; a free service (generously sponsored by{" "}
        <a href="https://www.cloudflare.com/?utm_source=ref&utm_medium=link&utm_campaign=isomorphic-git">
          Clever Cloud
        </a>
        ) for users of <a href="https://isomorphic-git.org">isomorphic-git</a>{" "}
        that enables cloning and pushing repos in the browser.
      </p>
      <p>
        The source code is hosted on Github at{" "}
        <a href="https://github.com/cristminix/isomorphic-cors-proxy">
          https://github.com/cristminix/isomorphic-cors-proxy
        </a>
      </p>
      <h2>Terms of Use</h2>
      <p>
        <b>
          This free service is provided to you AS IS with no guarantees. By
          using this free service, you promise not to use excessive amounts of
          bandwidth.
        </b>
      </p>
      <p>
        <b>
          If you are cloning or pushing large amounts of data your IP address
          may be banned. Please run your own instance of the software if you
          need to make heavy use this service.
        </b>
      </p>
      <h2>Allowed Origins</h2>
      This proxy allows git clone / fetch / push / getRemoteInfo requests from
      these domains:{" "}
      <code>
        {"{"}env.ALLOW_ORIGIN || "*"{"}"}
      </code>
    </html>
  )
}
function paramsToObject(entries) {
  const result = {}
  for (const [key, value] of entries) {
    // each 'entry' is a [key, value] tupple
    result[key] = value
  }
  return result
}
const service = async (c, next) => {
  const insecure_origins = ["http://localhost:5000"]
  const { req, res } = c
  const wrapped = cors({
    allowHeaders,
    exposeHeaders,
    allowMethods,
    credentials: false,
    origin: "*",
  })
  wrapped(c)
  let u = new URL(req.url)
  if (u.pathname === "/") {
    return c.html(<View />)
  }
  u.query = paramsToObject(u.searchParams)
  const requestHeaders = paramsToObject(req.raw.headers)
  const allowed = allow(req, u, requestHeaders)
  if (allowed) {
    if (req.method === "OPTIONS") {
      return c.text("")
    } else {
      let headers = {}
      for (let h of allowHeaders) {
        if (requestHeaders[h]) {
          headers[h] = requestHeaders[h]
        }
      }

      // GitHub uses user-agent sniffing for git/* and changes its behavior which is frustrating
      if (!headers["user-agent"] || !headers["user-agent"].startsWith("git/")) {
        headers["user-agent"] = "git/@isomorphic-git/cors-proxy"
      }
      let p = `${u.pathname}${u.search}`
      // console.log(`p=${p}`)
      let parts = p.match(/\/([^\/]*)\/(.*)/)
      let pathdomain = parts[1]
      let remainingpath = parts[2]
      let protocol = insecure_origins.includes(pathdomain) ? "http" : "https"
      const fetchUrl = `${protocol}://${pathdomain}/${remainingpath}`
      const requestBody = req.raw.body
      // console.log(requestBody, headers)
      const fetchOpt = {
        method: req.method,
        // keepalive: true,
        redirect: "manual",
        headers,
        body:
          req.method !== "GET" && req.method !== "HEAD"
            ? requestBody
            : undefined,
      }
      try {
        const f = await fetch(fetchUrl, fetchOpt)
        if (f.headers.has("location")) {
          let newUrl = f.headers.get("location").replace(/^https?:\//, "")
          f.headers.set("location", newUrl)
        }
        c.status(f.status)
        for (let h of exposeHeaders) {
          if (h === "content-length") continue
          if (f.headers.has(h)) {
            c.header(h, f.headers.get(h))
          }
        }
        if (f.redirected) {
          c.header("x-redirected-url", f.url)
        }
        return stream(c, async (stream) => {
          stream.onAbort(() => {
            console.log("Aborted!")
          })

          await stream.pipe(f.body)
        })
      } catch (error) {
        console.log(error)
      }
    }
  }
}

app.use(service)
export default app
