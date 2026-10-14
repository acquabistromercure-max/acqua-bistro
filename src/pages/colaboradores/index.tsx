import { Route, Routes } from 'react-router-dom'
import Lista from './Lista'
import Ficha from './Ficha'
import FormColaborador from './FormColaborador'

export default function Colaboradores() {
  return (
    <Routes>
      <Route index element={<Lista />} />
      <Route path="novo" element={<FormColaborador />} />
      <Route path=":id/editar" element={<FormColaborador />} />
      <Route path=":id" element={<Ficha />} />
    </Routes>
  )
}
