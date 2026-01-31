import React from 'react'

export default function Main({ children }) {
  return (
    <div className="flex-1 max-w-[1200px] w-full flex items-start min-h-screen flex-col justify-start ml-[10px] pt-[10px] pb-28 md:pb-0">
      {children}
    </div>
  )
}
