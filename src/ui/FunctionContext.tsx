import { createContext, useContext } from 'react'
import { FunctionScript } from '../model/types'
export const FunctionContext=createContext<FunctionScript[]>([])
export const useFunctions=()=>useContext(FunctionContext)
