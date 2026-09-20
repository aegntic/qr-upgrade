'use client';
import {useEffect,useRef} from 'react';
import {ServiceOperations,type ServiceEpochs} from '@/lib/service-operations';
export function useServiceOperations(epochs:ServiceEpochs){
 const ref=useRef<ServiceOperations|null>(null);if(!ref.current)ref.current=new ServiceOperations();
 const operations=ref.current;
 useEffect(()=>{operations.mount();return()=>operations.unmount();},[operations,epochs]);
 return operations;
}
