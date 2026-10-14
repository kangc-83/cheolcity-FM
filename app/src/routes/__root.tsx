import { Outlet, HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { useEffect, type ReactNode } from 'react'
import appCss from '../styles.css?url'
import meta from '../app-meta.json'
declare const __HF_DESIGN_INSPECTOR__: boolean
export const Route=createRootRoute({head:()=>({meta:[
{charSet:'utf-8'},{name:'viewport',content:'width=device-width, initial-scale=1'},
{title:meta.og_title||'철시티 풋볼 매니저'},
{name:'description',content:meta.og_description||'철시티 축구 모임 운영 도구'},
{name:'theme-color',content:'#F5F7F8'},{name:'robots',content:'noindex,nofollow'},
{property:'og:title',content:meta.og_title||'철시티 풋볼 매니저'},
{property:'og:description',content:meta.og_description||'철시티 축구 모임 운영 도구'},
{property:'og:type',content:'website'},
{property:'og:image',content:meta.og_image_url||'/assets/og-cheolcity.svg'},
{name:'twitter:card',content:'summary_large_image'},
],links:[{rel:'stylesheet',href:appCss},{rel:'icon',href:'/icons/favicon.svg',type:'image/svg+xml'},{rel:'apple-touch-icon',href:'/icons/apple-touch-icon.png'},{rel:'manifest',href:'/site.webmanifest'},{rel:'canonical',href:'https://cheolcity-football.higgsfield.app/'}]}),shellComponent:RootShell,component:()=> <Outlet/>,notFoundComponent:()=> <div className="not-found"><div className="brand-mark">C</div><h1>페이지를 찾을 수 없습니다.</h1><a href="/">대시보드로 돌아가기</a></div>})
function RootShell({children}:{children:ReactNode}){useEffect(()=>{if(typeof __HF_DESIGN_INSPECTOR__!=='undefined'&&__HF_DESIGN_INSPECTOR__){void import('../module/design-inspector/runtime').then(m=>m.installHiggsfieldDesignInspector()).catch(()=>{})}},[]);return <html lang="ko"><head><HeadContent/></head><body>{children}<Scripts/></body></html>}
