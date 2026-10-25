import { useParams } from "react-router-dom"
import { ImportPricingEditor } from "../../../components/import-pricing-editor"

const EditImportPricingPage = () => {
  const { id } = useParams<{ id: string }>()
  return <ImportPricingEditor productId={id} />
}

export default EditImportPricingPage
