import { Link } from 'react-router-dom'

import { Button } from '../components/ui'

export default function NotFound() {
  return (
    <div className="dark flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <p className="text-6xl font-bold text-primary">404</p>
      <h1 className="text-xl font-semibold text-foreground">This page does not exist</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The link may be out of date, or the page may have moved.
      </p>
      <div className="mt-2 flex gap-2">
        <Button variant="secondary" onClick={() => window.history.back()}>
          Go back
        </Button>
        <Link to="/">
          <Button>Home</Button>
        </Link>
      </div>
    </div>
  )
}
