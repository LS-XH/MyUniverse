import {createContext,useContext} from 'react'
import type {ClassDocument} from '../model/types'
export const FileActionsContext=createContext<{save:()=>void;refresh:()=>void;busy:boolean;dirtyEntities?:ReadonlySet<string>;savedDocument?:ClassDocument}|null>(null)
export const useFileActions=()=>useContext(FileActionsContext)
