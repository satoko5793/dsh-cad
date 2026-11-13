export const cleanError=error=>String(error.message||error).replace(/sk-[\w-]+/g,'[redacted]').slice(0,1200);
export function modelErrorMessage(error) {
  if(error.code==='DSH_NODE_UNAVAILABLE')return '模型服务需要独立 Node.js。请使用桌面启动脚本重新打开助手，或检查 GOUXING_NODE_EXE 配置。';
  if(['DSH_RUNTIME_INCOMPATIBLE','DSH_RUNTIME_EXITED'].includes(error.code)||/Unsupported\/no-context|DSH runtime exited/.test(error.message||''))return '模型服务启动失败，尚未进入建模。请重新打开助手后重试；详细原因已记录在本机 model-errors.log。';
  return cleanError(error);
}
