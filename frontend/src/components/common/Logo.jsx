export default function Logo({ size = 28 }) {
  return (
    <img
      src="/logo-tab.png"
      alt="logo"
      style={{
        width: size,
        height: size,
        objectFit: 'contain'
      }}
    />
  )
}