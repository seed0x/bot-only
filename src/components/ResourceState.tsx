type Props = { title: string; detail?: string; retry?: () => void; busy?: boolean }
export default function ResourceState({ title, detail, retry, busy = false }: Props) {
  return <div className={`resource-state${busy ? ' resource-loading' : ''}`} role="status" aria-busy={busy}>
    {busy && <span className="state-spinner" aria-hidden="true" />}
    <div><p>{title}</p>{detail && <p className="fine-print">{detail}</p>}</div>
    {retry && <button className="text-button" onClick={retry}>Retry</button>}
  </div>
}
