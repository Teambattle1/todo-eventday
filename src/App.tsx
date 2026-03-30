import { useTodos } from './hooks/useTodos'
import { useEmployees } from './hooks/useEmployees'
import { useShopping } from './hooks/useShopping'
import Dashboard from './components/Dashboard'

export default function App() {
  const { todos, loading, connected } = useTodos()
  const employees = useEmployees()
  const shopping = useShopping()

  return (
    <Dashboard
      todos={todos}
      employees={employees}
      loading={loading}
      connected={connected}
      shopping={shopping}
    />
  )
}
