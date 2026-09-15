#!/usr/bin/env node

import { spawn } from 'node:child_process'

const env = { ...process.env }

;(async() => {
  // Finish prerendering after Fly injects DATABASE_URL, then start the
  // self-contained server produced by Next's standalone output mode.
  if (process.argv.slice(-3).join(' ') === 'npm run start') {
    await exec('npx next build --experimental-build-mode generate')
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
