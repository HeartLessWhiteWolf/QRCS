/** Keep transport failures separate from a reachable but invalid public page. */
export async function checkPrivacyPage(url, supportEmail, fetchPage = globalThis.fetch) {
  let response;
  try { response = await fetchPage(url, { signal: AbortSignal.timeout(15000) }); }
  catch (error) { return { status: 'network-unverified', message: `公开隐私页网络验证未完成：${error.message}` }; }
  if (!response.ok) return { status: 'invalid', message: `公开隐私页返回 HTTP ${response.status}，请检查发布地址或托管状态。` };
  let body;
  try { body = await response.text(); }
  catch (error) { return { status: 'network-unverified', message: `公开隐私页正文未能完整读取：${error.message}` }; }
  if (!body.includes('QRCS') || !body.includes(supportEmail) || /【待填写|\{\{/.test(body)) {
    return { status: 'invalid', message: '公开隐私页正文与发布材料不匹配，或仍含待填写占位符。' };
  }
  return { status: 'passed', message: '公开 HTTPS 隐私页可读取且包含真实 QRCS 联系信息' };
}
