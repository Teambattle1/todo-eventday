import { useTodos } from './hooks/useTodos'
import { useEmployees } from './hooks/useEmployees'
import Dashboard from './components/Dashboard'

export default function App() {
  const { todos, loading, connected } = useTodos()
  const employees = useEmployees()

  return (
    <Dashboard
      todos={todos}
      employees={employees}
      loading={loading}
      connected={connected}
    />
  )
}
