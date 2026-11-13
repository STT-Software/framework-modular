interface FormHeadingProps {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
}

/** Encabezado de cada formulario: etiqueta con punto naranja, título y subtítulo. */
export function FormHeading({ id, eyebrow, title, subtitle }: FormHeadingProps) {
  return (
    <div className="mb-8">
      <p className="sa-eyebrow mb-3 flex items-center gap-2">
        <span />
        {eyebrow}
      </p>
      <h1
        id={id}
        className="text-[36px] font-bold tracking-tight text-[#190088] dark:text-white leading-tight"
      >
        {title}
      </h1>
      <p className="mt-3 text-[16px] font-normal leading-6 text-[#212121] dark:text-[#ECECEC]">{subtitle}</p>
    </div>
  );
}
