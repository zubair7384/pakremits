#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { cpSync } from 'node:fs'

const env = { ...process.env }

;(async() => {
  // Finish prerendering after Fly injects DATABASE_URL, then start the
  // self-contained server produced by Next's standalone output mode.
  if (process.argv.slice(-3).join(' ') === 'npm run start') {
    await exec('npx next build --experimental-build-mode generate')
    // Next's standalone server does not copy these directories itself. Without
    // them every file under /public and every generated CSS/JS chunk returns 404.
    cpSync('public', '.next/standalone/public', { recursive: true })
    cpSync('.next/static', '.next/standalone/.next/static', { recursive: true })
    await exec('node .next/standalone/server.js')
    return
  }

  // Launch any one-off command passed to the image.
  await exec(process.argv.slice(2).join(' '))
})()

function exec(command) {
  const child = spawn(command, { shell: true, stdio: 'inherit', env })
  return new Promise((resolve, reject) => {
    child.on('exit', code => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${command} failed rc=${code}`))
      }
    })
  })
}
