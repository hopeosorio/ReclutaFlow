export default function NotFound() {
  return (
    <section className="container narrow">
      <div className="card">
        <h2>No encontramos esta página</h2>
        <p>Verifica la URL o vuelve al inicio.</p>
        <a className="btn btn-primary" href="/">
          Ir al inicio
        </a>
      </div>
    </section>
  );
}
