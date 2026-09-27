/** Full document navigation discards cached admitted routes after the cookie is revoked. */
export function returnToGate() {
  const form = document.createElement('form')
  form.method = 'get'
  form.action = '/'
  form.hidden = true
  document.body.appendChild(form)
  form.submit()
}
