export function navigateBackOrHome(navigate) {
  const historyIndex = window.history.state?.idx
  if (Number.isInteger(historyIndex) && historyIndex > 0) {
    navigate(-1)
    return
  }
  navigate('/home', { replace: true })
}
